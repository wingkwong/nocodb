import { ModuleRef } from '@nestjs/core';
import { promisify } from 'util';
import { UITypes } from 'nocodb-sdk';
import Airtable from 'airtable';
import jsonfile from 'jsonfile';
import hash from 'object-hash';
import { T } from 'nc-help';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tinycolor from 'tinycolor2';
import extractRolesObj from '../../../utils/extractRolesObj'
import { AttachmentsService } from '../../attachments/attachments.service';
import { ColumnsService } from '../../columns/columns.service';
import { FiltersService } from '../../filters/filters.service';
import { FormColumnsService } from '../../form-columns/form-columns.service';
import { GalleriesService } from '../../galleries/galleries.service';
import { GridsService } from '../../grids/grids.service'
import { ProjectUsersService } from '../../project-users/project-users.service';
import { ProjectsService } from '../../projects/projects.service';
import { SortsService } from '../../sorts/sorts.service';
import { TablesService } from '../../tables/tables.service';
import { ViewColumnsService } from '../../view-columns/view-columns.service';
import { ViewsService } from '../../views/views.service';
// import {
//   attachmentService,
//   columnService,
//   filterService,
//   formViewColumnService,
//   formViewService,
//   galleryViewService,
//   gridViewService,
//   projectService,
//   projectUserService,
//   sortService,
//   tableService,
//   viewColumnService,
//   viewService,
//   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
//   // @ts-ignore
// } from '../..';
import FetchAT from './fetchAT';
import { importData, importLTARData } from './readAndProcessData';
import EntityMap from './EntityMap';
import type { UserType } from 'nocodb-sdk';
import { FormsService } from 'src/modules/forms/forms.service';

const writeJsonFileAsync = promisify(jsonfile.writeFile);

dayjs.extend(utc);

const selectColors = {
  // normal
  blue: '#cfdfff',
  cyan: '#d0f0fd',
  teal: '#c2f5e9',
  green: '#d1f7c4',
  orange: '#fee2d5',
  yellow: '#ffeab6',
  red: '#ffdce5',
  pink: '#ffdaf6',
  purple: '#ede2fe',
  gray: '#eee',
  // medium
  blueMedium: '#9cc7ff',
  cyanMedium: '#77d1f3',
  tealMedium: '#72ddc3',
  greenMedium: '#93e088',
  orangeMedium: '#ffa981',
  yellowMedium: '#ffd66e',
  redMedium: '#ff9eb7',
  pinkMedium: '#f99de2',
  purpleMedium: '#cdb0ff',
  grayMedium: '#ccc',
  // dark
  blueDark: '#2d7ff9',
  cyanDark: '#18bfff',
  tealDark: '#20d9d2',
  greenDark: '#20c933',
  orangeDark: '#ff6f2c',
  yellowDark: '#fcb400',
  redDark: '#f82b60',
  pinkDark: '#ff08c2',
  purpleDark: '#8b46ff',
  grayDark: '#666',
  // darker
  blueDarker: '#2750ae',
  cyanDarker: '#0b76b7',
  tealDarker: '#06a09b',
  greenDarker: '#338a17',
  orangeDarker: '#d74d26',
  yellowDarker: '#b87503',
  redDarker: '#ba1e45',
  pinkDarker: '#b2158b',
  purpleDarker: '#6b1cb0',
  grayDarker: '#444',
};

export default async (
  syncDB: AirtableSyncConfig,
  progress: (data: { msg?: string; level?: any }) => void,
) => {
  const tableService = syncDB.moduleRef.get(TablesService);
  const viewService = syncDB.moduleRef.get(ViewsService);
  const projectService = syncDB.moduleRef.get(ProjectsService);
  const attachmentService = syncDB.moduleRef.get(AttachmentsService);
  const columnService = syncDB.moduleRef.get(ColumnsService);
  const filterService = syncDB.moduleRef.get(FiltersService);
  const formViewColumnService = syncDB.moduleRef.get(FormColumnsService);
  const formViewService = syncDB.moduleRef.get(FormsService);
  const galleryViewService = syncDB.moduleRef.get(GalleriesService);
  const projectUserService = syncDB.moduleRef.get(ProjectUsersService);
  const viewColumnService = syncDB.moduleRef.get(ViewColumnsService);
  const sortService = syncDB.moduleRef.get(SortsService);
  const gridViewService = syncDB.moduleRef.get(GridsService);

  const sMapEM = new EntityMap('aTblId', 'ncId', 'ncName', 'ncParent');
  await sMapEM.init();
  const userRole = syncDB.user.roles
    .split(',')
    .reduce((rolesObj, role) => ({ [role]: true, ...rolesObj }), {});

  const sMap = {
    // static mapping records between aTblId && ncId
    async addToMappingTbl(aTblId, ncId, ncName, ncParent?) {
      await sMapEM.addRow({ aTblId, ncId, ncName, ncParent });
    },

    // get NcID from airtable ID
    async getNcIdFromAtId(aId) {
      return (await sMapEM.getRow('aTblId', aId, ['ncId']))?.ncId;
    },

    // get nc Parent from airtable ID
    async getNcParentFromAtId(aId) {
      return (await sMapEM.getRow('aTblId', aId, ['ncParent']))?.ncParent;
    },

    // get nc-title from airtable ID
    async getNcNameFromAtId(aId) {
      return (await sMapEM.getRow('aTblId', aId, ['ncName']))?.ncName;
    },
  };

  function logBasic(log) {
    progress({ level: 0, msg: log });
  }

  function logDetailed(log) {
    if (debugMode) progress({ level: 1, msg: log });
  }

  const perfStats = [];
  function recordPerfStart() {
    if (!debugMode) return 0;
    return Date.now();
  }
  function recordPerfStats(start, event) {
    if (!debugMode) return;
    const duration = Date.now() - start;
    perfStats.push({ d: duration, e: event });
  }

  let base, baseId;
  const start = Date.now();
  const enableErrorLogs = false;
  const generate_migrationStats = true;
  const debugMode = false;
  let g_aTblSchema = [];
  let ncCreatedProjectSchema: any = {};
  const ncLinkMappingTable: any[] = [];
  const nestedLookupTbl: any[] = [];
  const nestedRollupTbl: any[] = [];
  const ncSysFields = { id: 'ncRecordId', hash: 'ncRecordHash' };
  const storeLinks = false;
  const ncLinkDataStore: any = {};
  const insertedAssocRef: any = {};

  const atNcAliasRef: {
    [ncTableId: string]: {
      [ncTitle: string]: string;
    };
  } = {};

  const uniqueTableNameGen = getUniqueNameGenerator('sheet');

  // run time counter (statistics)
  const rtc = {
    sort: 0,
    filter: 0,
    view: {
      total: 0,
      grid: 0,
      gallery: 0,
      form: 0,
    },
    fetchAt: {
      count: 0,
      time: 0,
    },
    migrationSkipLog: {
      count: 0,
      log: [],
    },
    data: {
      records: 0,
      nestedLinks: 0,
    },
  };

  function updateMigrationSkipLog(tbl, col, type, reason?) {
    rtc.migrationSkipLog.count++;
    rtc.migrationSkipLog.log.push(
      `tn[${tbl}] cn[${col}] type[${type}] :: ${reason}`,
    );
  }

  // mapping table
  //

  async function getAirtableSchema(sDB) {
    const start = Date.now();

    if (!sDB.shareId)
      throw {
        message:
          'Invalid Shared Base ID :: Ensure www.airtable.com/<SharedBaseID> is accessible. Refer https://bit.ly/3x0OdXI for details',
      };

    if (sDB.shareId.startsWith('exp')) {
      const template = await FetchAT.readTemplate(sDB.shareId);
      await FetchAT.initialize(template.template.exploreApplication.shareId);
    } else {
      await FetchAT.initialize(sDB.shareId);
    }
    const ft = await FetchAT.read();
    const duration = Date.now() - start;
    rtc.fetchAt.count++;
    rtc.fetchAt.time += duration;

    if (!ft.baseId) {
      throw {
        message:
          'Invalid Shared Base ID :: Ensure www.airtable.com/<SharedBaseID> is accessible. Refer https://bit.ly/3x0OdXI for details',
      };
    }

    const file = ft.schema;
    baseId = ft.baseId;
    base = new Airtable({ apiKey: sDB.apiKey }).base(baseId);
    // store copy of airtable schema globally
    g_aTblSchema = file.tableSchemas;

    if (debugMode)
      await writeJsonFileAsync('aTblSchema.json', ft, { spaces: 2 });

    return file;
  }

  async function getViewData(viewId) {
    const start = Date.now();
    const ft = await FetchAT.readView(viewId);
    const duration = Date.now() - start;
    rtc.fetchAt.count++;
    rtc.fetchAt.time += duration;

    if (debugMode)
      await writeJsonFileAsync(`${viewId}.json`, ft, { spaces: 2 });
    return ft.view;
  }

  function getRootDbType() {
    return ncCreatedProjectSchema?.bases.find((el) => el.id === syncDB.baseId)
      ?.type;
  }

  // base mapping table
  const aTblNcTypeMap = {
    foreignKey: UITypes.LinkToAnotherRecord,
    text: UITypes.SingleLineText,
    multilineText: UITypes.LongText,
    richText: UITypes.LongText,
    multipleAttachment: UITypes.Attachment,
    checkbox: UITypes.Checkbox,
    multiSelect: UITypes.MultiSelect,
    select: UITypes.SingleSelect,
    collaborator: UITypes.Collaborator,
    multiCollaborator: UITypes.Collaborator,
    date: UITypes.Date,
    phone: UITypes.PhoneNumber,
    number: UITypes.Decimal,
    rating: UITypes.Rating,
    formula: UITypes.Formula,
    rollup: UITypes.Rollup,
    count: UITypes.Count,
    lookup: UITypes.Lookup,
    autoNumber: UITypes.AutoNumber,
    barcode: UITypes.SingleLineText,
    button: UITypes.Button,
  };

  //-----------------------------------------------------------------------------
  // aTbl helper routines
  //

  function nc_sanitizeName(name) {
    // replace all special characters by _
    return name.replace(/\W+/g, '_').trim();
  }

  function nc_getSanitizedColumnName(table, name) {
    let col_name = nc_sanitizeName(name);

    // truncate to 60 chars if character if exceeds above 60
    col_name = col_name?.slice(0, 60);

    // for knex, replace . with _
    const col_alias = name.trim().replace(/\./g, '_');

    // check if already a column exists with same name?
    const duplicateTitle = table.columns.find(
      (x) => x.title?.toLowerCase() === col_alias?.toLowerCase(),
    );
    const duplicateColumn = table.columns.find(
      (x) => x.column_name?.toLowerCase() === col_name?.toLowerCase(),
    );
    if (duplicateTitle) {
      if (enableErrorLogs) console.log(`## Duplicate title ${col_alias}`);
    }

    return {
      // kludge: error observed in Nc with space around column-name
      title: col_alias + (duplicateTitle ? '_2' : ''),
      column_name: col_name + (duplicateColumn ? '_2' : ''),
    };
  }

  const ncSchema = {
    tables: [],
    tablesById: {},
  };

  // aTbl: retrieve column name from column ID
  //
  function aTbl_getColumnName(colId): any {
    for (let i = 0; i < g_aTblSchema.length; i++) {
      const sheetObj = g_aTblSchema[i];
      const column = sheetObj.columns.find((col) => col.id === colId);
      if (column !== undefined)
        return {
          tn: sheetObj.name,
          cn: column.name,
        };
    }
  }

  async function nc_DumpTableSchema() {
    console.log('[');
    // const ncTblList = await api.base.tableList(
    //   ncCreatedProjectSchema.id,
    //   syncDB.baseId
    // );

    const ncTblList = { list: [] };
    ncTblList['list'] = await tableService.getAccessibleTables({
      projectId: ncCreatedProjectSchema.id,
      baseId: syncDB.baseId,
      roles: userRole,
    });

    for (let i = 0; i < ncTblList.list.length; i++) {
      // const ncTbl = await api.dbTable.read(ncTblList.list[i].id);
      const ncTbl = await tableService.getTableWithAccessibleViews({
        tableId: ncTblList.list[i].id,
        user: syncDB.user,
      });
      console.log(JSON.stringify(ncTbl, null, 2));
      console.log(',');
    }
    console.log(']');
  }

  // retrieve nc column schema from using aTbl field ID as reference
  //
  async function nc_getColumnSchema(aTblFieldId) {
    const ncTblId = await sMap.getNcParentFromAtId(aTblFieldId);
    const ncColId = await sMap.getNcIdFromAtId(aTblFieldId);

    // not migrated column, skip
    if (ncColId === undefined || ncTblId === undefined) return 0;

    return ncSchema.tablesById[ncTblId].columns.find((x) => x.id === ncColId);
  }

  // retrieve nc table schema using table name
  // optimize: create a look-up table & re-use information
  //
  async function nc_getTableSchema(tableName) {
    return ncSchema.tables.find((x) => x.title === tableName);
  }

  // delete project if already exists
  async function init({
    projectName,
  }: {
    projectName?: string;
    projectId?: string;
  }) {
    // delete 'sample' project if already exists
    const x = { list: [] };
    x['list'] = await projectService.projectList({
      user: { id: syncDB.user.id, roles: extractRolesObj(syncDB.user.roles) },
    });

    const sampleProj = x.list.find((a) => a.title === projectName);
    if (sampleProj) {
      await projectService.projectSoftDelete({
        projectId: sampleProj.id,
      });
    }
    logDetailed('Init');
  }

  // map UIDT
  //
  function getNocoType(col) {
    // start with default map
    let ncType = aTblNcTypeMap[col.type];

    // types email & url are marked as text
    // types currency & percent, duration are marked as number
    // types createTime & modifiedTime are marked as formula

    switch (col.type) {
      case 'text':
        if (col.typeOptions?.validatorName === 'email') ncType = UITypes.Email;
        else if (col.typeOptions?.validatorName === 'url') ncType = UITypes.URL;
        break;

      case 'number':
        // kludge: currency validation error with decimal places
        if (col.typeOptions?.format === 'percentV2') ncType = UITypes.Percent;
        else if (col.typeOptions?.format === 'duration')
          ncType = UITypes.Duration;
        else if (col.typeOptions?.format === 'currency')
          ncType = UITypes.Currency;
        else if (col.typeOptions?.precision > 0) ncType = UITypes.Decimal;
        break;

      case 'formula':
        if (col.typeOptions?.formulaTextParsed === 'CREATED_TIME()')
          ncType = UITypes.DateTime;
        else if (col.typeOptions?.formulaTextParsed === 'LAST_MODIFIED_TIME()')
          ncType = UITypes.DateTime;
        break;

      case 'computation':
        if (col.typeOptions?.resultType === 'collaborator')
          ncType = UITypes.Collaborator;
        break;

      case 'date':
        if (col.typeOptions?.isDateTime) ncType = UITypes.DateTime;
        break;
    }

    return ncType;
  }

  // retrieve additional options associated with selected data types
  //
  async function getNocoTypeOptions(col: any): Promise<any> {
    switch (col.type) {
      case 'select':
      case 'multiSelect': {
        // prepare options list in CSV format
        // note: NC doesn't allow comma's in options
        //
        const options = [];
        let order = 1;
        for (const [, value] of Object.entries(col.typeOptions.choices)) {
          // replace commas with dot for multiselect
          if (col.type === 'multiSelect') {
            (value as any).name = (value as any).name.replace(/,/g, '.');
          }
          // we don't allow empty records, placeholder instead
          if ((value as any).name === '') {
            (value as any).name = 'nc_empty';
          }
          // enumerate duplicates (we don't allow them)
          // TODO fix record mapping (this causes every record to map first option,
          //  we can't handle them using data api as they don't provide option id
          //  within data we might instead get the correct mapping from schema file )
          let dupNo = 1;
          const defaultName = (value as any).name;
          while (
            options.find(
              (el) =>
                el.title.toLowerCase() === (value as any).name.toLowerCase(),
            )
          ) {
            (value as any).name = `${defaultName}_${dupNo++}`;
          }
          options.push({
            order: order++,
            title: (value as any).name,
            color: selectColors[(value as any).color]
              ? selectColors[(value as any).color]
              : tinycolor.random().toHexString(),
          });

          await sMap.addToMappingTbl(
            (value as any).id,
            undefined,
            (value as any).name,
          );
        }
        return { type: col.type, data: options };
      }
      default:
        return { type: undefined };
    }
  }

  // convert to Nc schema (basic, excluding relations)
  //
  async function tablesPrepare(tblSchema: any[]) {
    const tables: any[] = [];

    for (let i = 0; i < tblSchema.length; ++i) {
      const table: any = {};

      if (syncDB.options.syncViews) {
        rtc.view.total += tblSchema[i].views.reduce(
          (acc, cur) =>
            ['grid', 'form', 'gallery'].includes(cur.type) ? ++acc : acc,
          0,
        );
      } else {
        rtc.view.total = tblSchema.length;
      }

      // Enable to use aTbl identifiers as is: table.id = tblSchema[i].id;
      table.title = tblSchema[i].name;
      let sanitizedName = nc_sanitizeName(tblSchema[i].name);

      // truncate to 50 chars if character if exceeds above 50
      // upto 64 should be fine but we are keeping it to 50 since
      // meta project adds prefix as well
      sanitizedName = sanitizedName?.slice(0, 50);

      // check for duplicate and populate a unique name if already exist
      table.table_name = uniqueTableNameGen(sanitizedName);

      const uniqueColNameGen = getUniqueNameGenerator('field');
      table.columns = [];
      const sysColumns = [
        {
          title: ncSysFields.id,
          column_name: ncSysFields.id,
          uidt: UITypes.ID,
          meta: {
            ag: 'nc',
          },
        },
        {
          title: ncSysFields.hash,
          column_name: ncSysFields.hash,
          uidt: UITypes.SingleLineText,
          system: true,
        },
      ];

      for (let j = 0; j < tblSchema[i].columns.length; j++) {
        const col = tblSchema[i].columns[j];

        // skip link, lookup, rollup fields in this iteration
        if (['foreignKey', 'lookup', 'rollup'].includes(col.type)) {
          continue;
        }

        // base column schema
        const ncName: any = nc_getSanitizedColumnName(table, col.name);
        const ncCol: any = {
          // Enable to use aTbl identifiers as is: id: col.id,
          title: ncName.title,
          column_name: uniqueColNameGen(ncName.column_name),
          uidt: getNocoType(col),
        };

        // not supported datatype: pure formula field
        // allow formula based computed fields (created time/ modified time to go through)
        if (ncCol.uidt === UITypes.Formula) {
          updateMigrationSkipLog(
            tblSchema[i].name,
            ncName.title,
            col.type,
            'column type not supported',
          );
          continue;
        }

        // change from default 'tinytext' as airtable allows more than 255 characters
        // for single line text column type
        if (col.type === 'text') ncCol.dt = 'text';

        // #fix-2363-decimal-out-of-range
        if (['sqlite3', 'mysql2'].includes(getRootDbType())) {
          if (ncCol.uidt === UITypes.Decimal) {
            ncCol.dt = 'double';
            ncCol.dtxp = 22;
            ncCol.dtxs = '2';
          }
        }

        // additional column parameters when applicable
        const colOptions = await getNocoTypeOptions(col);

        switch (colOptions.type) {
          case 'select':
          case 'multiSelect':
            ncCol.colOptions = {
              options: [...colOptions.data],
            };

            if (['mysql', 'mysql2'].includes(getRootDbType())) {
              // if options are empty, configure '' as an option
              ncCol.dtxp =
                colOptions.data
                  .map((el) => `'${el.title.replace(/'/gi, "''")}'`)
                  .join(',') || "''";
            }

            break;
          case undefined:
            break;
        }
        table.columns.push(ncCol);
      }
      table.columns.push(sysColumns[0]);
      table.columns.push(sysColumns[1]);

      tables.push(table);
    }
    return tables;
  }

  async function nocoCreateBaseSchema(aTblSchema) {
    // base schema preparation: exclude
    const tables: any[] = await tablesPrepare(aTblSchema);

    // for each table schema, create nc table
    for (let idx = 0; idx < tables.length; idx++) {
      logBasic(`:: [${idx + 1}/${tables.length}] ${tables[idx].title}`);

      logDetailed(`NC API: base.tableCreate ${tables[idx].title}`);

      let _perfStart = recordPerfStart();
      const table = await tableService.tableCreate({
        baseId: syncDB.baseId,
        projectId: ncCreatedProjectSchema.id,
        table: tables[idx],
        user: syncDB.user,
      });
      recordPerfStats(_perfStart, 'dbTable.create');

      updateNcTblSchema(table);

      // update mapping table
      await sMap.addToMappingTbl(aTblSchema[idx].id, table.id, table.title);
      for (let colIdx = 0; colIdx < table.columns.length; colIdx++) {
        const aId = aTblSchema[idx].columns.find(
          (x) =>
            x.name.trim().replace(/\./g, '_') === table.columns[colIdx].title,
        )?.id;
        if (aId)
          await sMap.addToMappingTbl(
            aId,
            table.columns[colIdx].id,
            table.columns[colIdx].title,
            table.id,
          );
      }

      // update default view name- to match it to airtable view name
      logDetailed(`NC API: dbView.list ${table.id}`);
      _perfStart = recordPerfStart();
      const view = { list: [] };
      view['list'] = await viewService.viewList({
        tableId: table.id,
        user: { roles: userRole },
      });
      recordPerfStats(_perfStart, 'dbView.list');

      const aTbl_grid = aTblSchema[idx].views.find((x) => x.type === 'grid');
      logDetailed(`NC API: dbView.update ${view.list[0].id} ${aTbl_grid.name}`);
      _perfStart = recordPerfStart();
      await viewService.viewUpdate({
        viewId: view.list[0].id,
        view: { title: aTbl_grid.name },
      });
      recordPerfStats(_perfStart, 'dbView.update');

      await updateNcTblSchemaById(table.id);

      await sMap.addToMappingTbl(
        aTbl_grid.id,
        table.views[0].id,
        aTbl_grid.name,
        table.id,
      );
    }

    return tables;
  }

  async function nocoCreateLinkToAnotherRecord(aTblSchema) {
    // Link to another RECORD
    for (let idx = 0; idx < aTblSchema.length; idx++) {
      const aTblLinkColumns = aTblSchema[idx].columns.filter(
        (x) => x.type === 'foreignKey',
      );

      // Link columns exist
      //
      if (aTblLinkColumns.length) {
        for (let i = 0; i < aTblLinkColumns.length; i++) {
          logDetailed(
            `[${idx + 1}/${aTblSchema.length}] Configuring Links :: [${i + 1}/${
              aTblLinkColumns.length
            }] ${aTblSchema[idx].name}`,
          );

          // for self links, there is no symmetric column
          {
            const src = aTbl_getColumnName(aTblLinkColumns[i].id);
            const dst = aTbl_getColumnName(
              aTblLinkColumns[i].typeOptions?.symmetricColumnId,
            );
            logDetailed(
              `LTAR ${src.tn}:${src.cn} <${aTblLinkColumns[i].typeOptions.relationship}> ${dst?.tn}:${dst?.cn}`,
            );
          }

          // check if link already established?
          if (!nc_isLinkExists(aTblLinkColumns[i].id)) {
            // parent table ID
            const srcTableId = await sMap.getNcIdFromAtId(aTblSchema[idx].id);

            // find child table name from symmetric column ID specified
            // self link, symmetricColumnId field will be undefined
            const childTable = aTbl_getColumnName(
              aTblLinkColumns[i].typeOptions?.symmetricColumnId,
            );

            // retrieve child table ID (nc) from table name
            let childTableId = srcTableId;
            if (childTable) {
              childTableId = (await nc_getTableSchema(childTable.tn)).id;
            }

            // check if already a column exists with this name?
            let _perfStart = recordPerfStart();
            const srcTbl: any = await tableService.getTableWithAccessibleViews({
              tableId: srcTableId,
              user: syncDB.user,
            });
            recordPerfStats(_perfStart, 'dbTable.read');

            // create link
            const ncName = nc_getSanitizedColumnName(
              srcTbl,
              aTblLinkColumns[i].name,
            );

            // LTAR alias ref to AT
            atNcAliasRef[srcTbl.id] = atNcAliasRef[srcTbl.id] || {};
            atNcAliasRef[srcTbl.id][ncName.title] = aTblLinkColumns[i].name;

            logDetailed(
              `NC API: dbTableColumn.create LinkToAnotherRecord ${ncName.title}`,
            );
            _perfStart = recordPerfStart();
            const ncTbl: any = await columnService.columnAdd({
              tableId: srcTableId,
              column: {
                uidt: UITypes.LinkToAnotherRecord,
                title: ncName.title,
                column_name: ncName.column_name,
                parentId: srcTableId,
                childId: childTableId,
                type: 'mm',
              },
              req: {
                user: syncDB.user.email,
                clientIp: '',
              },
            });
            recordPerfStats(_perfStart, 'dbTableColumn.create');

            updateNcTblSchema(ncTbl);

            const ncId = ncTbl.columns.find(
              (x) => x.title === ncName.title,
            )?.id;
            await sMap.addToMappingTbl(
              aTblLinkColumns[i].id,
              ncId,
              ncName.title,
              ncTbl.id,
            );

            // store link information in separate table
            // this information will be helpful in identifying relation pair
            const link = {
              nc: {
                title: ncName.title,
                parentId: srcTableId,
                childId: childTableId,
                type: 'mm',
              },
              aTbl: {
                tblId: aTblSchema[idx].id,
                ...aTblLinkColumns[i],
              },
            };

            ncLinkMappingTable.push(link);
          } else {
            // if link already exists, we need to change name of linked column
            // to what is represented in airtable

            // 1. extract associated link information from link table
            // 2. retrieve parent table information (source)
            // 3. using foreign parent & child column ID, find associated mapping in child table
            // 4. update column name
            const x = ncLinkMappingTable.findIndex(
              (x) =>
                x.aTbl.tblId ===
                  aTblLinkColumns[i].typeOptions.foreignTableId &&
                x.aTbl.id === aTblLinkColumns[i].typeOptions.symmetricColumnId,
            );

            let _perfStart = recordPerfStart();
            const childTblSchema: any =
              await tableService.getTableWithAccessibleViews({
                tableId: ncLinkMappingTable[x].nc.childId,
                user: syncDB.user,
              });
            recordPerfStats(_perfStart, 'dbTable.read');

            _perfStart = recordPerfStart();
            const parentTblSchema: any =
              await tableService.getTableWithAccessibleViews({
                tableId: ncLinkMappingTable[x].nc.parentId,
                user: syncDB.user,
              });
            recordPerfStats(_perfStart, 'dbTable.read');

            let parentLinkColumn = parentTblSchema.columns.find(
              (col) => col.title === ncLinkMappingTable[x].nc.title,
            );

            if (parentLinkColumn === undefined) {
              updateMigrationSkipLog(
                parentTblSchema?.title,
                ncLinkMappingTable[x].nc.title,
                UITypes.LinkToAnotherRecord,
                'Link error',
              );
              continue;
            }

            // hack // fix me
            if (parentLinkColumn.uidt !== 'LinkToAnotherRecord') {
              parentLinkColumn = parentTblSchema.columns.find(
                (col) => col.title === ncLinkMappingTable[x].nc.title + '_2',
              );
            }

            let childLinkColumn: any = {};

            if (parentLinkColumn.colOptions.type == 'hm') {
              // for hm:
              // mapping between child & parent column id is direct
              //
              childLinkColumn = childTblSchema.columns.find(
                (col) =>
                  col.uidt === UITypes.LinkToAnotherRecord &&
                  col.colOptions.fk_child_column_id ===
                    parentLinkColumn.colOptions.fk_child_column_id &&
                  col.colOptions.fk_parent_column_id ===
                    parentLinkColumn.colOptions.fk_parent_column_id,
              );
            } else {
              // for mm:
              // mapping between child & parent column id is inverted
              //
              childLinkColumn = childTblSchema.columns.find(
                (col) =>
                  col.uidt === UITypes.LinkToAnotherRecord &&
                  col.colOptions.fk_child_column_id ===
                    parentLinkColumn.colOptions.fk_parent_column_id &&
                  col.colOptions.fk_parent_column_id ===
                    parentLinkColumn.colOptions.fk_child_column_id &&
                  col.colOptions.fk_mm_model_id ===
                    parentLinkColumn.colOptions.fk_mm_model_id,
              );
            }

            // check if already a column exists with this name?
            const duplicate = childTblSchema.columns.find(
              (x) => x.title === aTblLinkColumns[i].name,
            );
            const suffix = duplicate ? '_2' : '';
            if (duplicate)
              if (enableErrorLogs)
                console.log(`## Duplicate ${aTblLinkColumns[i].name}`);

            // rename
            // note that: current rename API requires us to send all parameters,
            // not just title being renamed
            const ncName = nc_getSanitizedColumnName(
              childTblSchema,
              aTblLinkColumns[i].name,
            );

            logDetailed(
              `NC API: dbTableColumn.update rename symmetric column ${ncName.title}`,
            );
            _perfStart = recordPerfStart();
            const ncTbl: any = await columnService.columnUpdate({
              columnId: childLinkColumn.id,
              column: {
                ...childLinkColumn,
                title: ncName.title,
                column_name: ncName.column_name,
              },
            });
            recordPerfStats(_perfStart, 'dbTableColumn.update');

            updateNcTblSchema(ncTbl);

            const ncId = ncTbl.columns.find(
              (x) => x.title === aTblLinkColumns[i].name + suffix,
            )?.id;
            await sMap.addToMappingTbl(
              aTblLinkColumns[i].id,
              ncId,
              aTblLinkColumns[i].name + suffix,
              ncTbl.id,
            );
          }
        }
      }
    }
  }

  async function nocoCreateLookups(aTblSchema) {
    // LookUps
    for (let idx = 0; idx < aTblSchema.length; idx++) {
      const aTblColumns = aTblSchema[idx].columns.filter(
        (x) => x.type === 'lookup',
      );

      // parent table ID
      const srcTableId = await sMap.getNcIdFromAtId(aTblSchema[idx].id);
      const srcTableSchema = ncSchema.tablesById[srcTableId];

      if (aTblColumns.length) {
        // Lookup
        for (let i = 0; i < aTblColumns.length; i++) {
          logDetailed(
            `[${idx + 1}/${aTblSchema.length}] Configuring Lookup :: [${
              i + 1
            }/${aTblColumns.length}] ${aTblSchema[idx].name}`,
          );

          // something is not right, skip
          if (
            aTblColumns[i]?.typeOptions?.dependencies?.invalidColumnIds?.length
          ) {
            if (enableErrorLogs)
              console.log(`## Invalid column IDs mapped; skip`);

            updateMigrationSkipLog(
              srcTableSchema.title,
              aTblColumns[i].name,
              aTblColumns[i].type,
              'invalid column ID in dependency list',
            );
            continue;
          }

          const ncRelationColumnId = await sMap.getNcIdFromAtId(
            aTblColumns[i].typeOptions.relationColumnId,
          );
          const ncLookupColumnId = await sMap.getNcIdFromAtId(
            aTblColumns[i].typeOptions.foreignTableRollupColumnId,
          );

          if (
            ncLookupColumnId === undefined ||
            ncRelationColumnId === undefined
          ) {
            aTblColumns[i]['srcTableId'] = srcTableId;
            nestedLookupTbl.push(aTblColumns[i]);
            continue;
          }

          const ncName = nc_getSanitizedColumnName(
            srcTableSchema,
            aTblColumns[i].name,
          );

          logDetailed(`NC API: dbTableColumn.create LOOKUP ${ncName.title}`);
          const _perfStart = recordPerfStart();
          const ncTbl: any = await columnService.columnAdd({
            tableId: srcTableId,
            column: {
              uidt: UITypes.Lookup,
              title: ncName.title,
              column_name: ncName.column_name,
              fk_relation_column_id: ncRelationColumnId,
              fk_lookup_column_id: ncLookupColumnId,
            },
            req: {
              user: syncDB.user.email,
              clientIp: '',
            },
          });
          recordPerfStats(_perfStart, 'dbTableColumn.create');

          updateNcTblSchema(ncTbl);

          const ncId = ncTbl.columns.find(
            (x) => x.title === aTblColumns[i].name,
          )?.id;
          await sMap.addToMappingTbl(
            aTblColumns[i].id,
            ncId,
            aTblColumns[i].name,
            ncTbl.id,
          );
        }
      }
    }

    let level = 2;
    let nestedCnt = 0;
    while (nestedLookupTbl.length) {
      // if nothing has changed from previous iteration, skip rest
      if (nestedCnt === nestedLookupTbl.length) {
        for (let i = 0; i < nestedLookupTbl.length; i++) {
          const fTblField =
            nestedLookupTbl[i].typeOptions.foreignTableRollupColumnId;
          const name = aTbl_getColumnName(fTblField);
          updateMigrationSkipLog(
            ncSchema.tablesById[nestedLookupTbl[i].srcTableId]?.title,
            nestedLookupTbl[i].name,
            nestedLookupTbl[i].type,
            `foreign table field not found [${name.tn}/${name.cn}]`,
          );
        }
        if (enableErrorLogs)
          console.log(
            `## Failed to configure ${nestedLookupTbl.length} lookups`,
          );
        break;
      }

      // Nested lookup
      nestedCnt = nestedLookupTbl.length;
      for (let i = 0; i < nestedLookupTbl.length; i++) {
        const srcTableId = nestedLookupTbl[0].srcTableId;
        const srcTableSchema = ncSchema.tablesById[srcTableId];

        const ncRelationColumnId = await sMap.getNcIdFromAtId(
          nestedLookupTbl[0].typeOptions.relationColumnId,
        );
        const ncLookupColumnId = await sMap.getNcIdFromAtId(
          nestedLookupTbl[0].typeOptions.foreignTableRollupColumnId,
        );

        if (
          ncLookupColumnId === undefined ||
          ncRelationColumnId === undefined
        ) {
          continue;
        }

        const ncName = nc_getSanitizedColumnName(
          srcTableSchema,
          nestedLookupTbl[0].name,
        );

        logDetailed(
          `Configuring Nested Lookup: Level-${level} [${i + 1}/${nestedCnt} ${
            ncName.title
          }]`,
        );

        logDetailed(`NC API: dbTableColumn.create LOOKUP ${ncName.title}`);
        const _perfStart = recordPerfStart();
        const ncTbl: any = await columnService.columnAdd({
          tableId: srcTableId,
          column: {
            uidt: UITypes.Lookup,
            title: ncName.title,
            column_name: ncName.column_name,
            fk_relation_column_id: ncRelationColumnId,
            fk_lookup_column_id: ncLookupColumnId,
          },
          req: {
            user: syncDB.user.email,
            clientIp: '',
          },
        });
        recordPerfStats(_perfStart, 'dbTableColumn.create');

        updateNcTblSchema(ncTbl);

        const ncId = ncTbl.columns.find(
          (x) => x.title === nestedLookupTbl[0].name,
        )?.id;
        await sMap.addToMappingTbl(
          nestedLookupTbl[0].id,
          ncId,
          nestedLookupTbl[0].name,
          ncTbl.id,
        );

        // remove entry
        nestedLookupTbl.splice(0, 1);
      }
      level++;
    }
  }

  function getRollupNcFunction(aTblFunction) {
    const fn = aTblFunction.split('(')[0];
    const aTbl_ncRollUp = {
      AND: '',
      ARRAYCOMPACT: '',
      ARRAYJOIN: '',
      ARRAYUNIQUE: '',
      AVERAGE: 'average',
      CONCATENATE: '',
      COUNT: 'count',
      COUNTA: '',
      COUNTALL: '',
      MAX: 'max',
      MIN: 'min',
      OR: '',
      SUM: 'sum',
      XOR: '',
    };
    return aTbl_ncRollUp[fn];
  }

  async function nocoCreateRollup(aTblSchema) {
    // Rollup
    for (let idx = 0; idx < aTblSchema.length; idx++) {
      const aTblColumns = aTblSchema[idx].columns.filter(
        (x) => x.type === 'rollup',
      );

      // parent table ID
      const srcTableId = await sMap.getNcIdFromAtId(aTblSchema[idx].id);
      const srcTableSchema = ncSchema.tablesById[srcTableId];

      if (aTblColumns.length) {
        // rollup exist
        for (let i = 0; i < aTblColumns.length; i++) {
          logDetailed(
            `[${idx + 1}/${aTblSchema.length}] Configuring Rollup :: [${
              i + 1
            }/${aTblColumns.length}] ${aTblSchema[idx].name}`,
          );

          // fetch associated rollup function
          // skip column creation if supported rollup function does not exist
          const ncRollupFn = getRollupNcFunction(
            aTblColumns[i].typeOptions.formulaTextParsed,
          );

          if (ncRollupFn === '' || ncRollupFn === undefined) {
            updateMigrationSkipLog(
              srcTableSchema.title,
              aTblColumns[i].name,
              aTblColumns[i].type,
              `rollup function ${aTblColumns[i].typeOptions.formulaTextParsed} not supported`,
            );
            continue;
          }

          // something is not right, skip
          if (
            aTblColumns[i]?.typeOptions?.dependencies?.invalidColumnIds?.length
          ) {
            if (enableErrorLogs)
              console.log(`## Invalid column IDs mapped; skip`);

            updateMigrationSkipLog(
              srcTableSchema.title,
              aTblColumns[i].name,
              aTblColumns[i].type,
              'invalid column ID in dependency list',
            );
            continue;
          }

          const ncRelationColumnId = await sMap.getNcIdFromAtId(
            aTblColumns[i].typeOptions.relationColumnId,
          );
          const ncRollupColumnId = await sMap.getNcIdFromAtId(
            aTblColumns[i].typeOptions.foreignTableRollupColumnId,
          );

          if (ncRollupColumnId === undefined) {
            aTblColumns[i]['srcTableId'] = srcTableId;
            nestedRollupTbl.push(aTblColumns[i]);
            continue;
          }

          // skip, if rollup column was pointing to another virtual column
          const ncColSchema = await nc_getColumnSchema(
            aTblColumns[i].typeOptions.foreignTableRollupColumnId,
          );
          if (
            ncColSchema?.uidt === UITypes.Formula ||
            ncColSchema?.uidt === UITypes.Lookup ||
            ncColSchema?.uidt === UITypes.Rollup ||
            ncColSchema?.uidt === UITypes.Checkbox
          ) {
            updateMigrationSkipLog(
              srcTableSchema.title,
              aTblColumns[i].name,
              aTblColumns[i].type,
              'rollup referring to a column type not supported currently',
            );
            continue;
          }

          const ncName = nc_getSanitizedColumnName(
            srcTableSchema,
            aTblColumns[i].name,
          );

          logDetailed(`NC API: dbTableColumn.create ROLLUP ${ncName.title}`);
          const _perfStart = recordPerfStart();
          const ncTbl: any = await columnService.columnAdd({
            tableId: srcTableId,
            column: {
              uidt: UITypes.Rollup,
              title: ncName.title,
              column_name: ncName.column_name,
              fk_relation_column_id: ncRelationColumnId,
              fk_rollup_column_id: ncRollupColumnId,
              rollup_function: ncRollupFn,
            },
            req: {
              user: syncDB.user.email,
              clientIp: '',
            },
          });
          recordPerfStats(_perfStart, 'dbTableColumn.create');

          updateNcTblSchema(ncTbl);

          const ncId = ncTbl.columns.find(
            (x) => x.title === aTblColumns[i].name,
          )?.id;
          await sMap.addToMappingTbl(
            aTblColumns[i].id,
            ncId,
            aTblColumns[i].name,
            ncTbl.id,
          );
        }
      }
    }
    logDetailed(`Nested rollup: ${nestedRollupTbl.length}`);
  }

  async function nocoLookupForRollup() {
    const nestedCnt = nestedLookupTbl.length;
    for (let i = 0; i < nestedLookupTbl.length; i++) {
      const srcTableId = nestedLookupTbl[0].srcTableId;
      const srcTableSchema = ncSchema.tablesById[srcTableId];

      const ncRelationColumnId = await sMap.getNcIdFromAtId(
        nestedLookupTbl[0].typeOptions.relationColumnId,
      );
      const ncLookupColumnId = await sMap.getNcIdFromAtId(
        nestedLookupTbl[0].typeOptions.foreignTableRollupColumnId,
      );

      if (ncLookupColumnId === undefined || ncRelationColumnId === undefined) {
        continue;
      }

      const ncName = nc_getSanitizedColumnName(
        srcTableSchema,
        nestedLookupTbl[0].name,
      );

      logDetailed(
        `Configuring Lookup over Rollup :: [${i + 1}/${nestedCnt}] ${
          ncName.title
        }`,
      );

      logDetailed(`NC API: dbTableColumn.create LOOKUP ${ncName.title}`);
      const _perfStart = recordPerfStart();
      const ncTbl: any = await columnService.columnAdd({
        tableId: srcTableId,
        column: {
          uidt: UITypes.Lookup,
          title: ncName.title,
          column_name: ncName.column_name,
          fk_relation_column_id: ncRelationColumnId,
          fk_lookup_column_id: ncLookupColumnId,
        },
        req: {
          user: syncDB.user.email,
          clientIp: '',
        },
      });
      recordPerfStats(_perfStart, 'dbTableColumn.create');

      updateNcTblSchema(ncTbl);

      const ncId = ncTbl.columns.find(
        (x) => x.title === nestedLookupTbl[0].name,
      )?.id;
      await sMap.addToMappingTbl(
        nestedLookupTbl[0].id,
        ncId,
        nestedLookupTbl[0].name,
        ncTbl.id,
      );

      // remove entry
      nestedLookupTbl.splice(0, 1);
    }
  }

  async function nocoSetPrimary(aTblSchema) {
    for (let idx = 0; idx < aTblSchema.length; idx++) {
      logDetailed(
        `[${idx + 1}/${aTblSchema.length}] Configuring Display value : ${
          aTblSchema[idx].name
        }`,
      );

      const pColId = aTblSchema[idx].primaryColumnId;
      const ncColId = await sMap.getNcIdFromAtId(pColId);

      // skip primary column configuration if we field not migrated
      if (ncColId) {
        logDetailed(`NC API: dbTableColumn.primaryColumnSet`);
        const _perfStart = recordPerfStart();
        await columnService.columnSetAsPrimary({ columnId: ncColId });
        recordPerfStats(_perfStart, 'dbTableColumn.primaryColumnSet');

        // update schema
        const ncTblId = await sMap.getNcIdFromAtId(aTblSchema[idx].id);
        await updateNcTblSchemaById(ncTblId);
      }
    }
  }

  // retrieve nc-view column ID from corresponding nc-column ID
  async function nc_getViewColumnId(viewId, viewType, ncColumnId) {
    // retrieve view Info
    let viewDetails;

    const _perfStart = recordPerfStart();
    if (viewType === 'form') {
      viewDetails = (await formViewService.formViewGet({ formViewId: viewId }))
        .columns;
      recordPerfStats(_perfStart, 'dbView.formRead');
    } else if (viewType === 'gallery') {
      viewDetails = (
        await galleryViewService.galleryViewGet({ galleryViewId: viewId })
      ).columns;
      recordPerfStats(_perfStart, 'dbView.galleryRead');
    } else {
      viewDetails = await viewColumnService.columnList({ viewId: viewId });
      recordPerfStats(_perfStart, 'dbView.gridColumnsList');
    }

    return viewDetails.find((x) => x.fk_column_id === ncColumnId)?.id;
  }

  //////////  Data processing

  async function nocoBaseDataProcessing_v2(sDB, table, record) {
    const recordHash = hash(record);
    const rec = { ...record.fields };

    // kludge -
    // trim spaces on either side of column name
    // leads to error in NocoDB
    Object.keys(rec).forEach((key) => {
      const replacedKey = key.trim().replace(/\./g, '_');
      if (key !== replacedKey) {
        rec[replacedKey] = rec[key];
        delete rec[key];
      }
    });

    // post-processing on the record
    for (const [key, value] of Object.entries(rec as { [key: string]: any })) {
      // retrieve datatype
      const dt = table.columns.find((x) => x.title === key)?.uidt;

      // always process LTAR, Lookup, and Rollup columns as we delete the key after processing
      if (
        !value &&
        dt !== UITypes.LinkToAnotherRecord &&
        dt !== UITypes.Lookup &&
        dt !== UITypes.Rollup
      ) {
        rec[key] = null;
        continue;
      }

      switch (dt) {
        // https://www.npmjs.com/package/validator
        // default value: digits_after_decimal: [2]
        // if currency, set decimal place to 2
        //
        case UITypes.Currency:
          rec[key] = (+value).toFixed(2);
          break;

        // we will pick up LTAR once all table data's are in place
        case UITypes.LinkToAnotherRecord:
          if (storeLinks) {
            if (ncLinkDataStore[table.title][record.id] === undefined)
              ncLinkDataStore[table.title][record.id] = {
                id: record.id,
                fields: {},
              };
            ncLinkDataStore[table.title][record.id]['fields'][key] = value;
          }
          delete rec[key];
          break;

        // these will be automatically populated depending on schema configuration
        case UITypes.Lookup:
        case UITypes.Rollup:
          delete rec[key];
          break;

        case UITypes.Collaborator:
          // in case of multi-collaborator, this will be an array
          if (Array.isArray(value)) {
            let collaborators = '';
            for (let i = 0; i < value.length; i++) {
              collaborators += `${value[i]?.name} <${value[i]?.email}>, `;
              rec[key] = collaborators;
            }
          } else rec[key] = `${value?.name} <${value?.email}>`;
          break;

        case UITypes.Button:
          rec[key] = `${value?.label} <${value?.url}>`;
          break;

        case UITypes.DateTime:
        case UITypes.CreateTime:
        case UITypes.LastModifiedTime:
          rec[key] = dayjs(value).format('YYYY-MM-DD HH:mm');
          break;

        case UITypes.Date:
          if (/\d{5,}/.test(value)) {
            // skip
            rec[key] = null;
            logBasic(`:: Invalid date ${value}`);
          } else {
            rec[key] = dayjs(value).format('YYYY-MM-DD');
          }
          break;

        case UITypes.SingleSelect:
          if (value === '') {
            rec[key] = 'nc_empty';
          }
          rec[key] = value;
          break;

        case UITypes.MultiSelect:
          rec[key] = value
            ?.map((v) => {
              if (v === '') {
                return 'nc_empty';
              }
              return `${v.replace(/,/g, '.')}`;
            })
            .join(',');
          break;

        case UITypes.Attachment:
          if (!syncDB.options.syncAttachment) rec[key] = null;
          else {
            let tempArr = [];

            try {
              logBasic(
                ` :: Retrieving attachment :: ${value
                  ?.map((a) => a.filename?.split('?')?.[0])
                  .join(', ')}`,
              );
              tempArr = await attachmentService.uploadViaURL({
                path: `noco/${sDB.projectName}/${table.title}/${key}`,
                urls: value?.map((attachment) => ({
                  fileName: attachment.filename?.split('?')?.[0],
                  url: attachment.url,
                  size: attachment.size,
                  mimetype: attachment.type,
                })),
              });
            } catch (e) {
              console.log(e);
            }

            rec[key] = JSON.stringify(tempArr);
          }
          break;

        case UITypes.SingleLineText:
          // Barcode data
          if (value?.text) {
            rec[key] = value.text;
          }
          break;

        default:
          break;
      }
    }

    // insert airtable record ID explicitly into each records
    rec[ncSysFields.id] = record.id;
    rec[ncSysFields.hash] = recordHash;

    return rec;
  }

  async function nocoReadDataSelected(projName, table, callback, fields) {
    return new Promise((resolve, reject) => {
      base(table.title)
        .select({
          pageSize: 100,
          // maxRecords: 100,
          fields: fields,
        })
        .eachPage(
          async function page(records, fetchNextPage) {
            // This function (`page`) will get called for each page of records.
            // records.forEach(record => callback(table, record));
            logBasic(
              `:: ${table.title} / ${fields} : ${
                recordCnt + 1
              } ~ ${(recordCnt += 100)}`,
            );
            await Promise.all(
              records.map((r) => callback(projName, table, r, fields)),
            );

            // To fetch the next page of records, call `fetchNextPage`.
            // If there are more records, `page` will get called again.
            // If there are no more records, `done` will get called.
            fetchNextPage();
          },
          function done(err) {
            if (err) {
              console.error(err);
              reject(err);
            }
            resolve(null);
          },
        );
    });
  }

  //////////

  function nc_isLinkExists(airtableFieldId) {
    return !!ncLinkMappingTable.find(
      (x) => x.aTbl.typeOptions.symmetricColumnId === airtableFieldId,
    );
  }

  async function nocoCreateProject(projName) {
    // create empty project (XC-DB)
    logDetailed(`Create Project: ${projName}`);
    const _perfStart = recordPerfStart();

    ncCreatedProjectSchema = await projectService.projectCreate({
      project: { title: projName },
      user: { id: syncDB.user.id },
    });

    recordPerfStats(_perfStart, 'project.create');
  }

  async function nocoGetProject(projId) {
    // create empty project (XC-DB)
    logDetailed(`Getting project meta: ${projId}`);
    const _perfStart = recordPerfStart();
    ncCreatedProjectSchema = await projectService.getProjectWithInfo({
      projectId: projId,
    });
    recordPerfStats(_perfStart, 'project.read');
  }

  async function nocoConfigureGalleryView(sDB, aTblSchema) {
    if (!sDB.options.syncViews) return;
    for (let idx = 0; idx < aTblSchema.length; idx++) {
      const tblId = (await nc_getTableSchema(aTblSchema[idx].name)).id;
      const galleryViews = aTblSchema[idx].views.filter(
        (x) => x.type === 'gallery',
      );

      const configuredViews = rtc.view.grid + rtc.view.gallery + rtc.view.form;
      rtc.view.gallery += galleryViews.length;

      for (let i = 0; i < galleryViews.length; i++) {
        logDetailed(`   Axios fetch view-data`);

        // create view
        await getViewData(galleryViews[i].id);
        const viewName = aTblSchema[idx].views.find(
          (x) => x.id === galleryViews[i].id,
        )?.name;

        logBasic(
          `:: [${configuredViews + i + 1}/${rtc.view.total}] Gallery : ${
            aTblSchema[idx].name
          } / ${viewName}`,
        );

        logDetailed(`NC API dbView.galleryCreate :: ${viewName}`);
        const _perfStart = recordPerfStart();
        await galleryViewService.galleryViewCreate({
          tableId: tblId,
          gallery: {
            title: viewName,
          },
        });
        recordPerfStats(_perfStart, 'dbView.galleryCreate');

        await updateNcTblSchemaById(tblId);
      }
    }
  }

  async function nocoConfigureFormView(sDB, aTblSchema) {
    if (!sDB.options.syncViews) return;
    for (let idx = 0; idx < aTblSchema.length; idx++) {
      const tblId = await sMap.getNcIdFromAtId(aTblSchema[idx].id);
      const formViews = aTblSchema[idx].views.filter((x) => x.type === 'form');

      const configuredViews = rtc.view.grid + rtc.view.gallery + rtc.view.form;
      rtc.view.form += formViews.length;
      for (let i = 0; i < formViews.length; i++) {
        logDetailed(`   Axios fetch view-data`);

        // create view
        const vData = await getViewData(formViews[i].id);
        const viewName = aTblSchema[idx].views.find(
          (x) => x.id === formViews[i].id,
        )?.name;

        logBasic(
          `:: [${configuredViews + i + 1}/${rtc.view.total}] Form : ${
            aTblSchema[idx].name
          } / ${viewName}`,
        );

        // everything is default
        let refreshMode = 'NO_REFRESH';
        let msg = 'Thank you for submitting the form!';
        let desc = '';

        // response will not include form object if everything is default
        //
        if (vData.metadata?.form) {
          if (vData.metadata.form?.refreshAfterSubmit)
            refreshMode = vData.metadata.form.refreshAfterSubmit;
          if (vData.metadata.form?.afterSubmitMessage)
            msg = vData.metadata.form.afterSubmitMessage;
          if (vData.metadata.form?.description)
            desc = vData.metadata.form.description;
        }

        const formData = {
          title: viewName,
          heading: viewName,
          subheading: desc,
          success_msg: msg,
          submit_another_form: refreshMode.includes('REFRESH_BUTTON'),
          show_blank_form: refreshMode.includes('AUTO_REFRESH'),
        };

        logDetailed(`NC API dbView.formCreate :: ${viewName}`);
        const _perfStart = recordPerfStart();
        // const f = await api.dbView.formCreate(tblId, formData);
        const f = await formViewService.formViewCreate({
          tableId: tblId,
          body: formData,
        });
        recordPerfStats(_perfStart, 'dbView.formCreate');

        logDetailed(
          `[${idx + 1}/${aTblSchema.length}][Form View][${i + 1}/${
            formViews.length
          }] Create ${viewName}`,
        );

        await updateNcTblSchemaById(tblId);

        logDetailed(`   Configure show/hide columns`);
        await nc_configureFields(
          f.id,
          vData,
          aTblSchema[idx].name,
          viewName,
          'form',
        );
      }
    }
  }

  async function nocoConfigureGridView(sDB, aTblSchema) {
    for (let idx = 0; idx < aTblSchema.length; idx++) {
      const tblId = await sMap.getNcIdFromAtId(aTblSchema[idx].id);
      const gridViews = aTblSchema[idx].views.filter((x) => x.type === 'grid');

      let viewCnt = idx;
      if (syncDB.options.syncViews)
        viewCnt = rtc.view.grid + rtc.view.gallery + rtc.view.form;
      rtc.view.grid += gridViews.length;

      for (let i = 0; i < (sDB.options.syncViews ? gridViews.length : 1); i++) {
        logDetailed(`   Axios fetch view-data`);
        // fetch viewData JSON
        const vData = await getViewData(gridViews[i].id);

        // retrieve view name & associated NC-ID
        const viewName = aTblSchema[idx].views.find(
          (x) => x.id === gridViews[i].id,
        )?.name;
        const _perfStart = recordPerfStart();
        // const viewList: any = await api.dbView.list(tblId);
        const viewList = { list: [] };
        viewList['list'] = await viewService.viewList({
          tableId: tblId,
          user: { roles: userRole },
        });
        recordPerfStats(_perfStart, 'dbView.list');

        let ncViewId = viewList?.list?.find((x) => x.tn === viewName)?.id;

        logBasic(
          `:: [${viewCnt + i + 1}/${rtc.view.total}] Grid : ${
            aTblSchema[idx].name
          } / ${viewName}`,
        );

        // create view (default already created)
        if (i > 0) {
          logDetailed(`NC API dbView.gridCreate :: ${viewName}`);
          const _perfStart = recordPerfStart();
          const viewCreated = await gridViewService.gridViewCreate({
            tableId: tblId,
            grid: {
              title: viewName,
            },
          });
          recordPerfStats(_perfStart, 'dbView.gridCreate');

          await updateNcTblSchemaById(tblId);
          await sMap.addToMappingTbl(
            gridViews[i].id,
            viewCreated.id,
            viewName,
            tblId,
          );
          ncViewId = viewCreated.id;
        }

        logDetailed(`   Configure show/hide columns`);
        await nc_configureFields(
          ncViewId,
          vData,
          aTblSchema[idx].name,
          viewName,
          'grid',
        );

        // configure filters
        if (vData?.filters) {
          logDetailed(`   Configure filter set`);

          // skip filters if nested
          if (!vData.filters.filterSet.find((x) => x?.type === 'nested')) {
            await nc_configureFilters(ncViewId, vData.filters);
          }
        }

        // configure sort
        if (vData?.lastSortsApplied?.sortSet.length) {
          logDetailed(`   Configure sort set`);
          await nc_configureSort(ncViewId, vData.lastSortsApplied);
        }
      }
    }
  }

  async function nocoAddUsers(aTblSchema) {
    const userRoles = {
      owner: 'owner',
      create: 'creator',
      edit: 'editor',
      comment: 'commenter',
      read: 'viewer',
      none: 'viewer',
    };
    const userList = aTblSchema.appBlanket.userInfoById;
    const totalUsers = Object.keys(userList).length;
    let cnt = 0;
    const insertJobs: Promise<any>[] = [];

    for (const [, value] of Object.entries(
      userList as { [key: string]: any },
    )) {
      logDetailed(
        `[${++cnt}/${totalUsers}] NC API auth.projectUserAdd :: ${value.email}`,
      );
      const _perfStart = recordPerfStart();
      insertJobs.push(
        projectUserService
          .userInvite({
            projectId: ncCreatedProjectSchema.id,
            projectUser: {
              email: value.email,
              roles: userRoles[value.permissionLevel],
            },
            req: { user: syncDB.user, clientIp: '' },
          })
          .catch((e) =>
            e.response?.data?.msg
              ? logBasic(`NOTICE: ${e.response.data.msg}`)
              : console.log(e),
          ),
      );
      recordPerfStats(_perfStart, 'auth.projectUserAdd');
    }
    await Promise.all(insertJobs);
  }

  function updateNcTblSchema(tblSchema) {
    const tblId = tblSchema.id;

    // replace entry from array if already exists
    const idx = ncSchema.tables.findIndex((x) => x.id === tblId);
    if (idx !== -1) ncSchema.tables.splice(idx, 1);
    ncSchema.tables.push(tblSchema);

    // overwrite object if it exists
    ncSchema.tablesById[tblId] = tblSchema;
  }

  async function updateNcTblSchemaById(tblId) {
    const _perfStart = recordPerfStart();
    const ncTbl: any = await tableService.getTableWithAccessibleViews({
      tableId: tblId,
      user: syncDB.user,
    });
    recordPerfStats(_perfStart, 'dbTable.read');

    updateNcTblSchema(ncTbl);
  }

  ///////////////////////

  // statistics
  //
  const migrationStats = [];

  async function generateMigrationStats(aTblSchema) {
    const migrationStatsObj = {
      table_name: '',
      aTbl: {
        columns: 0,
        links: 0,
        lookup: 0,
        rollup: 0,
      },
      nc: {
        columns: 0,
        links: 0,
        lookup: 0,
        rollup: 0,
        invalidColumn: 0,
      },
    };
    for (let idx = 0; idx < aTblSchema.length; idx++) {
      migrationStatsObj.table_name = aTblSchema[idx].name;

      const aTblLinkColumns = aTblSchema[idx].columns.filter(
        (x) => x.type === 'foreignKey',
      );
      const aTblLookup = aTblSchema[idx].columns.filter(
        (x) => x.type === 'lookup',
      );
      const aTblRollup = aTblSchema[idx].columns.filter(
        (x) => x.type === 'rollup',
      );

      let invalidColumnId = 0;
      for (let i = 0; i < aTblLookup.length; i++) {
        if (
          aTblLookup[i]?.typeOptions?.dependencies?.invalidColumnIds?.length
        ) {
          invalidColumnId++;
        }
      }
      for (let i = 0; i < aTblRollup.length; i++) {
        if (
          aTblRollup[i]?.typeOptions?.dependencies?.invalidColumnIds?.length
        ) {
          invalidColumnId++;
        }
      }

      migrationStatsObj.aTbl.columns = aTblSchema[idx].columns.length;
      migrationStatsObj.aTbl.links = aTblLinkColumns.length;
      migrationStatsObj.aTbl.lookup = aTblLookup.length;
      migrationStatsObj.aTbl.rollup = aTblRollup.length;

      const ncTbl = await nc_getTableSchema(aTblSchema[idx].name);
      const linkColumn = ncTbl.columns.filter(
        (x) => x.uidt === UITypes.LinkToAnotherRecord,
      );
      const lookup = ncTbl.columns.filter((x) => x.uidt === UITypes.Lookup);
      const rollup = ncTbl.columns.filter((x) => x.uidt === UITypes.Rollup);

      // all links hardwired as m2m. m2m generates additional tables per link
      // hence link/2
      migrationStatsObj.nc.columns =
        ncTbl.columns.length - linkColumn.length / 2;
      migrationStatsObj.nc.links = linkColumn.length / 2;
      migrationStatsObj.nc.lookup = lookup.length;
      migrationStatsObj.nc.rollup = rollup.length;
      migrationStatsObj.nc.invalidColumn = invalidColumnId;

      const temp = JSON.parse(JSON.stringify(migrationStatsObj));
      migrationStats.push(temp);
    }

    const columnSum = migrationStats.reduce((accumulator, object) => {
      return accumulator + object.nc.columns;
    }, 0);
    const linkSum = migrationStats.reduce((accumulator, object) => {
      return accumulator + object.nc.links;
    }, 0);
    const lookupSum = migrationStats.reduce((accumulator, object) => {
      return accumulator + object.nc.lookup;
    }, 0);
    const rollupSum = migrationStats.reduce((accumulator, object) => {
      return accumulator + object.nc.rollup;
    }, 0);

    logBasic(`Quick Summary:`);
    logBasic(`:: Total Tables:   ${aTblSchema.length}`);
    logBasic(`:: Total Columns:  ${columnSum}`);
    logBasic(`::   Links:        ${linkSum}`);
    logBasic(`::   Lookup:       ${lookupSum}`);
    logBasic(`::   Rollup:       ${rollupSum}`);
    logBasic(`:: Total Filters:  ${rtc.filter}`);
    logBasic(`:: Total Sort:     ${rtc.sort}`);
    logBasic(`:: Total Views:    ${rtc.view.total}`);
    logBasic(`::   Grid:         ${rtc.view.grid}`);
    logBasic(`::   Gallery:      ${rtc.view.gallery}`);
    logBasic(`::   Form:         ${rtc.view.form}`);
    logBasic(`:: Total Records:  ${rtc.data.records}`);
    logBasic(`:: Total Nested Links: ${rtc.data.nestedLinks}`);

    const duration = Date.now() - start;
    logBasic(`:: Migration time:      ${duration}`);
    logBasic(`:: Axios fetch count:   ${rtc.fetchAt.count}`);
    logBasic(`:: Axios fetch time:    ${rtc.fetchAt.time}`);

    if (debugMode) {
      await writeJsonFileAsync('stats.json', perfStats, { spaces: 2 });
      const perflog = [];
      for (let i = 0; i < perfStats.length; i++) {
        perflog.push(`${perfStats[i].e}, ${perfStats[i].d}`);
      }
      await writeJsonFileAsync('stats.csv', perflog, { spaces: 2 });
      await writeJsonFileAsync('skip.txt', rtc.migrationSkipLog.log, {
        spaces: 2,
      });
    }

    T.event({
      event: 'a:airtable-import:success',
      data: {
        stats: {
          migrationTime: duration,
          totalTables: aTblSchema.length,
          totalColumns: columnSum,
          links: linkSum,
          lookup: lookupSum,
          rollup: rollupSum,
          totalFilters: rtc.filter,
          totalSort: rtc.sort,
          view: {
            total: rtc.view.total,
            grid: rtc.view.grid,
            gallery: rtc.view.gallery,
            form: rtc.view.form,
          },
          axios: {
            count: rtc.fetchAt.count,
            time: rtc.fetchAt.time,
          },
          totalRecords: rtc.data.records,
          nestedLinks: rtc.data.nestedLinks,
        },
      },
    });
  }

  //////////////////////////////
  // filters

  const filterMap = {
    '=': 'eq',
    '!=': 'neq',
    '<': 'lt',
    '<=': 'lte',
    '>': 'gt',
    '>=': 'gte',
    isEmpty: 'empty',
    isNotEmpty: 'notempty',
    contains: 'like',
    doesNotContain: 'nlike',
    isAnyOf: 'anyof',
    isNoneOf: 'nanyof',
    '|': 'anyof',
    '&': 'allof',
  };

  async function nc_configureFilters(viewId, f) {
    for (let i = 0; i < f.filterSet.length; i++) {
      const filter = f.filterSet[i];
      const colSchema = await nc_getColumnSchema(filter.columnId);

      // column not available;
      // one of not migrated column;
      if (!colSchema) {
        updateMigrationSkipLog(
          await sMap.getNcNameFromAtId(viewId),
          colSchema.title,
          colSchema.uidt,
          `filter config skipped; column not migrated`,
        );
        continue;
      }
      const columnId = colSchema.id;
      const datatype = colSchema.uidt;
      const ncFilters = [];

      // console.log(filter)
      if (datatype === UITypes.Date || datatype === UITypes.DateTime) {
        // skip filters over data datatype
        updateMigrationSkipLog(
          await sMap.getNcNameFromAtId(viewId),
          colSchema.title,
          colSchema.uidt,
          `filter config skipped; filter over date datatype not supported`,
        );
        continue;
      }

      // single-select & multi-select
      else if (
        datatype === UITypes.SingleSelect ||
        datatype === UITypes.MultiSelect
      ) {
        if (filter.operator === 'doesNotContain') {
          filter.operator = 'isNoneOf';
        }
        // if array, break it down to multiple filters
        if (Array.isArray(filter.value)) {
          const fx = {
            fk_column_id: columnId,
            logical_op: f.conjunction,
            comparison_op: filterMap[filter.operator],
            value: (
              await Promise.all(
                filter.value.map(async (f) => await sMap.getNcNameFromAtId(f)),
              )
            ).join(','),
          };
          ncFilters.push(fx);
        }
        // not array - add as is
        else if (filter.value) {
          const fx = {
            fk_column_id: columnId,
            logical_op: f.conjunction,
            comparison_op: filterMap[filter.operator],
            value: await sMap.getNcNameFromAtId(filter.value),
          };
          ncFilters.push(fx);
        }
      }

      // other data types (number/ text/ long text/ ..)
      else if (filter.value) {
        const fx = {
          fk_column_id: columnId,
          logical_op: f.conjunction,
          comparison_op: filterMap[filter.operator],
          value: filter.value,
        };
        ncFilters.push(fx);
      }

      // insert filters
      for (let i = 0; i < ncFilters.length; i++) {
        const _perfStart = recordPerfStart();
        await filterService.filterCreate({
          viewId: viewId,
          filter: ncFilters[i],
        });
        recordPerfStats(_perfStart, 'dbTableFilter.create');

        rtc.filter++;
      }
    }
  }

  async function nc_configureSort(viewId, s) {
    for (let i = 0; i < s.sortSet.length; i++) {
      const columnId = (await nc_getColumnSchema(s.sortSet[i].columnId))?.id;

      if (columnId) {
        const _perfStart = recordPerfStart();
        await sortService.sortCreate({
          viewId: viewId,
          sort: {
            fk_column_id: columnId,
            direction: s.sortSet[i].ascending ? 'asc' : 'desc',
          },
        });
        recordPerfStats(_perfStart, 'dbTableSort.create');
      }
      rtc.sort++;
    }
  }

  async function nc_configureFields(_viewId, _c, tblName, viewName, viewType?) {
    // force hide PK column
    const hiddenColumns = [ncSysFields.id, ncSysFields.hash];
    const c = _c.columnOrder;

    // column order corrections
    // retrieve table schema
    const ncTbl = await nc_getTableSchema(tblName);
    // retrieve view ID
    const viewId = ncTbl.views.find((x) => x.title === viewName).id;
    let viewDetails;

    const _perfStart = recordPerfStart();
    if (viewType === 'form') {
      viewDetails = (await formViewService.formViewGet({ formViewId: viewId }))
        .columns;
      recordPerfStats(_perfStart, 'dbView.formRead');
    } else if (viewType === 'gallery') {
      viewDetails = (
        await galleryViewService.galleryViewGet({
          galleryViewId: viewId,
        })
      ).columns;
      recordPerfStats(_perfStart, 'dbView.galleryRead');
    } else {
      viewDetails = await viewColumnService.columnList({ viewId: viewId });
      recordPerfStats(_perfStart, 'dbView.gridColumnsList');
    }

    // nc-specific columns; default hide.
    for (let j = 0; j < hiddenColumns.length; j++) {
      const ncColumnId = ncTbl.columns.find(
        (x) => x.title === hiddenColumns[j],
      ).id;
      const ncViewColumnId = viewDetails.find(
        (x) => x.fk_column_id === ncColumnId,
      )?.id;
      if (ncViewColumnId === undefined) continue;

      // first two positions held by record id & record hash
      const _perfStart = recordPerfStart();
      await viewColumnService.columnUpdate({
        viewId: viewId,
        columnId: ncViewColumnId,
        column: {
          show: false,
          order: j + 1 + c.length,
        },
      });
      recordPerfStats(_perfStart, 'dbViewColumn.update');
    }

    // rest of the columns from airtable- retain order & visibility property
    for (let j = 0; j < c.length; j++) {
      const ncColumnId = await sMap.getNcIdFromAtId(c[j].columnId);
      const ncViewColumnId = await nc_getViewColumnId(
        viewId,
        viewType,
        ncColumnId,
      );
      if (ncViewColumnId === undefined) continue;

      // first two positions held by record id & record hash
      const configData = { show: c[j].visibility, order: j + 1 };
      if (viewType === 'form') {
        if (_c?.metadata?.form?.fieldsByColumnId?.[c[j].columnId]) {
          const x = _c.metadata.form.fieldsByColumnId[c[j].columnId];
          const formData = { ...configData };
          if (x?.title) formData[`label`] = x.title;
          if (x?.required) formData[`required`] = x.required;
          if (x?.description) formData[`description`] = x.description;
          const _perfStart = recordPerfStart();
          await formViewColumnService.columnUpdate({
            formViewColumnId: ncViewColumnId,
            formViewColumn: formData,
          });
          recordPerfStats(_perfStart, 'dbView.formColumnUpdate');
        }
      }
      const _perfStart = recordPerfStart();
      await viewColumnService.columnUpdate({
        viewId: viewId,
        columnId: ncViewColumnId,
        column: configData,
      });
      recordPerfStats(_perfStart, 'dbViewColumn.update');
    }
  }

  ///////////////////////////////////////////////////////////////////////////////
  let recordCnt = 0;
  try {
    logBasic('SDK initialized');
    logDetailed('Project initialization started');
    // delete project if already exists
    if (debugMode) await init(syncDB);

    logDetailed('Project initialized');

    logBasic('Retrieving Airtable schema');
    // read schema file
    const schema = await getAirtableSchema(syncDB);
    const aTblSchema = schema.tableSchemas;
    logDetailed('Project schema extraction completed');

    if (!syncDB.projectId) {
      if (!syncDB.projectName)
        throw new Error('Project name or id not provided');
      // create empty project
      await nocoCreateProject(syncDB.projectName);
      logDetailed('Project created');
    } else {
      await nocoGetProject(syncDB.projectId);
      syncDB.projectName = ncCreatedProjectSchema?.title;
      syncDB.baseId = syncDB.baseId || ncCreatedProjectSchema.bases[0].id;
      logDetailed('Getting existing project meta');
    }

    logBasic('Importing Tables...');
    // prepare table schema (base)
    await nocoCreateBaseSchema(aTblSchema);
    logDetailed('Table creation completed');

    logDetailed('Configuring Links');
    // add LTAR
    await nocoCreateLinkToAnotherRecord(aTblSchema);
    logDetailed('Migrating LTAR columns completed');

    if (syncDB.options.syncLookup) {
      logDetailed(`Configuring Lookup`);
      // add look-ups
      await nocoCreateLookups(aTblSchema);
      logDetailed('Migrating Lookup columns completed');
    }

    if (syncDB.options.syncRollup) {
      logDetailed('Configuring Rollup');
      // add roll-ups
      await nocoCreateRollup(aTblSchema);
      logDetailed('Migrating Rollup columns completed');

      if (syncDB.options.syncLookup) {
        logDetailed('Migrating Lookup form Rollup columns');
        // lookups for rollup
        await nocoLookupForRollup();
        logDetailed('Migrating Lookup form Rollup columns completed');
      }
    }
    logDetailed('Configuring Display Value column');
    // configure Display Value
    await nocoSetPrimary(aTblSchema);
    logDetailed('Configuring Display Value column completed');

    logBasic('Configuring User(s)');
    // add users
    await nocoAddUsers(schema);
    logDetailed('Adding users completed');

    // hide-fields
    // await nocoReconfigureFields(aTblSchema);

    logBasic('Syncing views');
    // configure views
    await nocoConfigureGridView(syncDB, aTblSchema);
    await nocoConfigureFormView(syncDB, aTblSchema);
    await nocoConfigureGalleryView(syncDB, aTblSchema);
    logDetailed('Syncing views completed');

    if (syncDB.options.syncData) {
      try {
        // await nc_DumpTableSchema();
        const _perfStart = recordPerfStart();
        const ncTblList = { list: [] };
        ncTblList['list'] = await tableService.getAccessibleTables({
          projectId: ncCreatedProjectSchema.id,
          baseId: syncDB.baseId,
          roles: userRole,
        });
        recordPerfStats(_perfStart, 'base.tableList');

        logBasic('Reading Records...');

        const recordsMap = {};

        for (let i = 0; i < ncTblList.list.length; i++) {
          // not a migrated table, skip
          if (
            undefined ===
            aTblSchema.find((x) => x.name === ncTblList.list[i].title)
          )
            continue;

          const _perfStart = recordPerfStart();
          const ncTbl: any = await tableService.getTableWithAccessibleViews({
            tableId: ncTblList.list[i].id,
            user: syncDB.user,
          });
          recordPerfStats(_perfStart, 'dbTable.read');

          recordCnt = 0;

          recordsMap[ncTbl.id] = await importData({
            projectName: syncDB.projectName,
            table: ncTbl,
            base,
            logBasic,
            nocoBaseDataProcessing_v2,
            sDB: syncDB,
            logDetailed,
          });
          rtc.data.records += await recordsMap[ncTbl.id].getCount();

          logDetailed(`Data inserted from ${ncTbl.title}`);
        }

        logBasic('Configuring Record Links...');
        for (let i = 0; i < ncTblList.list.length; i++) {
          // not a migrated table, skip
          if (
            undefined ===
            aTblSchema.find((x) => x.name === ncTblList.list[i].title)
          )
            continue;

          // const ncTbl = await api.dbTable.read(ncTblList.list[i].id);
          const ncTbl: any = await tableService.getTableWithAccessibleViews({
            tableId: ncTblList.list[i].id,
            user: syncDB.user,
          });

          rtc.data.nestedLinks += await importLTARData({
            table: ncTbl,
            projectName: syncDB.projectName,
            base,
            fields: null, //Object.values(tblLinkGroup).flat(),
            logBasic,
            insertedAssocRef,
            logDetailed,
            records: recordsMap[ncTbl.id],
            atNcAliasRef,
            ncLinkMappingTable,
            syncDB,
          });
        }
      } catch (error) {
        logDetailed(
          `There was an error while migrating data! Please make sure your API key (${syncDB.apiKey}) is correct.`,
        );
        logDetailed(`Error: ${error}`);
      }
    }
    if (generate_migrationStats) {
      await generateMigrationStats(aTblSchema);
    }
  } catch (e) {
    if (e.response?.data?.msg) {
      T.event({
        event: 'a:airtable-import:error',
        data: { error: e.response.data.msg },
      });
      throw new Error(e.response.data.msg);
    }
    throw e;
  }
};

export function getUniqueNameGenerator(defaultName = 'name') {
  const namesRef = {};

  return (initName: string = defaultName): string => {
    let name = initName === '_' ? defaultName : initName;
    let c = 0;
    while (name in namesRef) {
      name = `${initName}_${++c}`;
    }
    namesRef[name] = true;
    return name;
  };
}

export interface AirtableSyncConfig {
  id: string;
  baseURL: string;
  authToken: string;
  projectName?: string;
  projectId?: string;
  baseId?: string;
  apiKey: string;
  shareId: string;
  user: UserType;
  options: {
    syncViews: boolean;
    syncData: boolean;
    syncRollup: boolean;
    syncLookup: boolean;
    syncFormula: boolean;
    syncAttachment: boolean;
  };
  moduleRef: ModuleRef;
}
