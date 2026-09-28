import { Prisma } from '@prisma/client';

describe('ReturnRequest.orderId schema', () => {
  it('is indexed but not unique so canceled returns can be recreated', () => {
    const returnRequest = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === 'ReturnRequest',
    );

    expect(returnRequest).toBeDefined();
    expect(returnRequest?.uniqueFields).not.toContainEqual(['orderId']);
    expect(returnRequest?.uniqueIndexes).not.toContainEqual(
      expect.objectContaining({ fields: ['orderId'] }),
    );
  });
});
