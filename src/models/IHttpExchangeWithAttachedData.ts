import { IHttpExchange } from './IHttpExchange.js';

export interface IHttpExchangeWithAttachedData<RequestType, ResponseType, AttachedDataType> {
    exchange: IHttpExchange<RequestType, ResponseType>;
    data: AttachedDataType
}
