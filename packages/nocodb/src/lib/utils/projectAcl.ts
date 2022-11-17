import { OrgUserRoles } from '../../enums/OrgUserRoles';

export default {
  owner: {
    exclude: {
      pluginList: true,
      pluginTest: true,
      pluginRead: true,
      pluginUpdate: true,
      isPluginActive: true,
    },
  },
  creator: {
    exclude: {
      pluginList: true,
      pluginTest: true,
      pluginRead: true,
      pluginUpdate: true,
      isPluginActive: true,
    },
  },
  guest: {},
  editor: {
    include: {
      hideAllColumns: true,
      showAllColumns: true,
      auditRowUpdate: true,
      passwordChange: true,
      // new permissions
      // project
      projectGet: true,
      projectList: true,
      projectCost: true,
      //table
      tableList: true,
      tableGet: true,

      // data
      dataList: true,
      dataUpdate: true,
      dataDelete: true,
      dataInsert: true,
      dataRead: true,
      dataExist: true,
      dataFindOne: true,
      dataGroupBy: true,
      commentsCount: true,
      exportCsv: true,
      exportExcel: true,

      viewList: true,
      columnList: true,
      viewColumnUpdate: true,

      sortList: true,
      sortCreate: true,
      sortUpdate: true,
      sortDelete: true,

      filterList: true,
      filterCreate: true,
      filterUpdate: true,
      filterDelete: true,
      filterGet: true,
      filterChildrenRead: true,

      mmList: true,
      hmList: true,
      mmExcludedList: true,
      hmExcludedList: true,
      btExcludedList: true,
      commentList: true,
      commentRow: true,

      formViewGet: true,
      projectInfoGet: true,
      gridColumnUpdate: true,
      galleryViewGet: true,
      kanbanViewGet: true,
      groupedDataList: true,

      // old
      xcTableAndViewList: true,
      xcAuditCreate: true,
      xcAttachmentUpload: true,
      xcVirtualTableList: true,
      rolesGet: true,
      tableXcModelGet: true,
      xcRelationsGet: true,
      xcModelsList: true,
      xcViewModelsList: true,
      xcProcedureModelsList: true,
      xcFunctionModelsList: true,
      xcTableModelsList: true,
      xcCronList: true,
      xcRelationList: true,
      tableMetaCreate: true,
      tableMetaDelete: true,
      tableMetaRecreate: true,
      viewMetaCreate: true,
      viewMetaDelete: true,
      viewMetaRecreate: true,
      procedureMetaCreate: true,
      procedureMetaDelete: true,
      procedureMetaRecreate: true,
      functionMetaCreate: true,
      functionMetaDelete: true,
      functionMetaRecreate: true,

      tableCreateStatement: true,
      tableInsertStatement: true,
      tableUpdateStatement: true,
      tableSelectStatement: true,
      tableDeleteStatement: true,

      functionList: true,
      sequenceList: true,
      procedureList: true,
      triggerList: true,
      relationList: true,
      relationListAll: true,
      indexList: true,
      list: true,
      viewRead: true,
      functionRead: true,
      procedureRead: true,

      getKnexDataTypes: true,
      DB_PROJECT_OPEN_BY_WEB: true,
      PROJECT_READ_BY_WEB: true,
      projectGenerateBackend: true,
      projectGenerateBackendGql: true,
      projectGetTsPolicyPath: true,
      projectGetPolicyPath: true,
      projectGetGqlPolicyPath: true,
      handleApiCall: true,
      executeRawQuery: true,
      projectHasDb: true,
      testConnection: true,
      projectChangeEnv: true,

      xcRoutesPolicyAllGet: true,
      grpcProtoDownloadZip: true,

      xcModelRowAuditAndCommentList: true,
      xcAuditCommentInsert: true,
      xcAuditModelCommentsCount: true,
      xcExportAsCsv: true,

      bulkDataInsert: true,
      bulkDataUpdate: true,
      bulkDataUpdateAll: true,
      bulkDataDelete: true,
      bulkDataDeleteAll: true,
      relationDataRemove: true,
      relationDataAdd: true,
      dataCount: true,
      upload: true,
      uploadViaURL: true,
      swaggerJson:true
    },
  },
  commenter: {
    include: {
      formViewGet: true,
      passwordChange: true,
      // project
      projectGet: true,
      exportCsv: true,
      exportExcel: true,

      //table
      tableGet: true,
      // sort & filter
      sortList: true,
      viewList: true,
      columnList: true,

      mmList: true,
      hmList: true,
      commentList: true,
      commentRow: true,
      projectInfoGet: true,

      // data
      dataList: true,
      dataRead: true,
      dataExist: true,
      dataFindOne: true,
      dataGroupBy: true,
      commentsCount: true,

      galleryViewGet: true,
      kanbanViewGet: true,
      groupedDataList: true,

      xcTableAndViewList: true,
      xcVirtualTableList: true,
      projectList: true,
      projectCost: true,
      PROJECT_READ_BY_WEB: true,

      tableXcModelGet: true,
      xcRelationList: true,
      tableList: true,
      functionList: true,
      sequenceList: true,
      procedureList: true,
      triggerList: true,
      relationList: true,
      relationListAll: true,
      indexList: true,
      list: true,

      xcModelRowAuditAndCommentList: true,
      xcAuditCommentInsert: true,
      xcAuditModelCommentsCount: true,
      xcExportAsCsv: true,
      dataCount: true,
      swaggerJson:true
    },
  },
  viewer: {
    include: {
      formViewGet: true,
      passwordChange: true,
      // project
      projectGet: true,
      //table
      tableGet: true,
      // data
      dataList: true,
      dataRead: true,
      dataExist: true,
      dataFindOne: true,
      dataGroupBy: true,
      commentsCount: true,
      exportCsv: true,
      exportExcel: true,

      // sort & filter
      sortList: true,
      filterList: true,
      projectInfoGet: true,

      galleryViewGet: true,
      kanbanViewGet: true,
      groupedDataList: true,

      mmList: true,
      hmList: true,
      commentList: true,
      commentRow: false,

      xcTableAndViewList: true,
      xcVirtualTableList: true,
      projectList: true,
      projectCost: true,
      PROJECT_READ_BY_WEB: true,

      tableXcModelGet: true,
      xcRelationList: true,
      tableList: true,
      viewList: true,
      functionList: true,
      sequenceList: true,
      procedureList: true,
      columnList: true,
      triggerList: true,
      relationList: true,
      relationListAll: true,
      indexList: true,
      list: true,
      xcExportAsCsv: true,
      dataCount: true,
      swaggerJson:true
    },
  },
  [OrgUserRoles.VIEWER]: {
    include: {
      apiTokenList: true,
      apiTokenCreate: true,
      apiTokenDelete: true,
      passwordChange: true,
      projectList: true,
    },
  },
  [OrgUserRoles.SUPER_ADMIN]: '*',
  [OrgUserRoles.CREATOR]: {
    include: {
      apiTokenList: true,
      apiTokenCreate: true,
      apiTokenDelete: true,
      upload: true,
      uploadViaURL: true,
      passwordChange: true,
      pluginList: true,
      pluginRead: true,
      pluginTest: true,
      isPluginActive: true,
      pluginUpdate: true,
      projectCreate: true,
      projectList: true,
      projectCost: true,
      handleAxiosCall: true,
      testConnection: true,
      projectCreateByWeb: true,
      projectCreateByWebWithXCDB: true,
      xcPluginRead: true,
      xcMetaTablesImportZipToLocalFsAndDb: true,
      xcMetaTablesExportDbToZip: true,
      auditRowUpdate: true,
    },
  },
};
