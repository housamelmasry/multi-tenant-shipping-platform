ALTER TABLE "return_requests"
ADD COLUMN "original_order_status" TEXT;

UPDATE "return_requests" AS return_request
SET "original_order_status" = COALESCE(
  (
    SELECT history."toStatus"
    FROM "OrderStatusHistory" AS history
    WHERE history."orderId" = return_request."order_id"
    ORDER BY history."createdAt" DESC, history."id" DESC
    LIMIT 1
  ),
  'FAILED'
);

DROP INDEX "return_requests_order_id_key";

CREATE INDEX "return_requests_order_id_idx"
ON "return_requests"("order_id");