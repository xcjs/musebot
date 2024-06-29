import { IHttpExchange } from './IHttpExchange.js';

export interface IHttpExchangeWithAttachedResponse<RequestType, ResponseType, AttachedResponseType> {
    exchange: IHttpExchange<RequestType, ResponseType>;
    response: AttachedResponseType
}
