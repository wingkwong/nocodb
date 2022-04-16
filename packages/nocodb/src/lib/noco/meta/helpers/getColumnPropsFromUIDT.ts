import { SqlUIColumn, SqlUiFactory, UITypes } from 'nocodb-sdk';
import Base from '../../../noco-models/Base';

export default function getColumnPropsFromUIDT(
  column: SqlUIColumn & { uidt: UITypes },
  base: Base
) {
  const sqlUi = SqlUiFactory.create(base.getConnectionConfig());

  const colProp = sqlUi.getDataTypeForUiType(column);
  const newColumn = {
    rqd: false,
    pk: false,
    ai: false,
    cdf: null,
    un: false,
    dtx: 'specificType',
    ...colProp
  };

  newColumn.dtxp = sqlUi.getDefaultLengthForDatatype(newColumn.dt);
  newColumn.dtxs = sqlUi.getDefaultScaleForDatatype(newColumn.dt);

  const selectTypes = [UITypes.MultiSelect, UITypes.SingleSelect];
  if (
    column &&
    selectTypes.includes(newColumn.uidt) &&
    selectTypes.includes(column.uidt)
  ) {
    newColumn.dtxp = column.dtxp;
  }

  newColumn.altered = column.altered || 2;

  return { ...newColumn, ...column };
}
