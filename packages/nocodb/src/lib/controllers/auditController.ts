import { Request, Response, Router } from 'express';
import Audit from '../models/Audit';
import { AuditOperationTypes } from 'nocodb-sdk';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';

import { getAjvValidatorMw } from '../meta/api/helpers';
import { auditService } from '../services';

export async function commentRow(req: Request<any, any>, res) {
  res.json(
    await Audit.insert({
      ...req.body,
      user: (req as any).user,
      op_type: AuditOperationTypes.COMMENT,
    })
  );
}

export async function auditRowUpdate(req: Request<any, any>, res) {
  res.json(
    await auditService.auditRowUpdate({
      rowId: req.params.rowId,
      body: {
        ...req.body,
      },
    })
  );
}

export async function commentList(req: Request<any, any, any>, res) {
  res.json(await Audit.commentsList(req.query));
}

export async function auditList(req: Request, res: Response) {
  res.json(
    new PagedResponseImpl(
      await Audit.projectAuditList(req.params.projectId, req.query),
      {
        count: await Audit.projectAuditCount(req.params.projectId),
        ...req.query,
      }
    )
  );
}

export async function commentsCount(req: Request<any, any, any>, res) {
  res.json(
    await Audit.commentsCount({
      fk_model_id: req.query.fk_model_id as string,
      ids: req.query.ids as string[],
    })
  );
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/audits/comments',
  ncMetaAclMw(commentList, 'commentList')
);
router.post(
  '/api/v1/db/meta/audits/comments',
  getAjvValidatorMw('swagger.json#/components/schemas/CommentReq'),
  ncMetaAclMw(commentRow, 'commentRow')
);
router.post(
  '/api/v1/db/meta/audits/rows/:rowId/update',
  getAjvValidatorMw('swagger.json#/components/schemas/AuditRowUpdateReq'),
  ncMetaAclMw(auditRowUpdate, 'auditRowUpdate')
);
router.get(
  '/api/v1/db/meta/audits/comments/count',
  ncMetaAclMw(commentsCount, 'commentsCount')
);
router.get(
  '/api/v1/db/meta/projects/:projectId/audits',
  ncMetaAclMw(auditList, 'auditList')
);
export default router;
