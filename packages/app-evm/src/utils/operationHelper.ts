import { ISDK } from '@cypherock/sdk-core';
import { DeviceAppError, DeviceAppErrorType } from '@cypherock/sdk-interfaces';
import { OnStatus } from '@cypherock/sdk-utils';
import { ChunkRequest, ChunkResponse } from '../proto/generated/common';
import { DeepPartial, Exact, Query, Result } from '../proto/generated/evm/core';
import { assertOrThrowInvalidResult, parseCoreError } from './asserts';

export function decodeResult(data: Uint8Array) {
  let result: Result;

  try {
    result = Result.decode(data);
  } catch (error) {
    throw new DeviceAppError(DeviceAppErrorType.INVALID_RESULT);
  }

  return result;
}

export function encodeQuery<I extends Exact<DeepPartial<Query>, I>>(query: I) {
  return Uint8Array.from(Query.encode(Query.create(query)).finish());
}

type QueryKey = keyof Query;

type ResultKey = keyof Result;

export class OperationHelper<Q extends QueryKey, R extends ResultKey> {
  public readonly sdk: ISDK;

  private readonly queryKey: QueryKey;

  private readonly resultKey: ResultKey;

  private readonly onStatus?: OnStatus;

  private static readonly CHUNK_SIZE = 5120;

  constructor(params: {
    sdk: ISDK;
    queryKey: Q;
    resultKey: R;
    onStatus?: OnStatus;
  }) {
    this.sdk = params.sdk;

    this.queryKey = params.queryKey;

    this.resultKey = params.resultKey;

    this.onStatus = params.onStatus;
  }

  public async sendQuery<I extends Query[Q]>(query: I) {
    return this.sdk.sendQuery(encodeQuery({ [this.queryKey]: query } as any));
  }

  public async waitForResult() {
    const result = decodeResult(
      await this.sdk.waitForResult({ onStatus: this.onStatus }),
    );

    const retrunObj = result[this.resultKey] as Result[R];
    assertOrThrowInvalidResult(retrunObj);
    parseCoreError((result[this.resultKey] as any).coreError);

    return retrunObj;
  }

  private static splitIntoChunks(txn: Uint8Array): Uint8Array[] {
    const chunks: Uint8Array[] = [];
    const totalChunks = Math.ceil(txn.length / OperationHelper.CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i += 1) {
      const chunk = txn.slice(
        i * OperationHelper.CHUNK_SIZE,
        i * OperationHelper.CHUNK_SIZE + OperationHelper.CHUNK_SIZE,
      );
      chunks.push(chunk);
    }

    return chunks;
  }

  public async sendInChunks<
    RK extends keyof Exclude<Result[R], null | undefined>,
    QK extends keyof Exclude<Query[Q], null | undefined>,
  >(data: Uint8Array, queryKey: QK, resultKey: RK) {
    const chunks = OperationHelper.splitIntoChunks(data);
    let remainingSize = data.length;

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];

      const result = await this.waitForResult();
      assertOrThrowInvalidResult(result[resultKey]);

      const { chunkRequest } = result[resultKey] as {
        chunkRequest: ChunkRequest;
      };

      assertOrThrowInvalidResult(chunkRequest);
      assertOrThrowInvalidResult(chunkRequest.chunkIndex === i);

      remainingSize -= chunk.length;

      const chunkResponse: ChunkResponse = {
        chunk,
        chunkIndex: i,
        totalChunks: chunks.length,
        remainingSize,
      };

      await this.sendQuery({
        [queryKey]: {
          chunkResponse,
        },
      });
    }
  }
}