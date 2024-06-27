import { IHttpExchange } from './IHttpExchange';

export interface IHttpExchangeWithAttachedResponse<RequestType, ResponseType, AttachedResponseType> {
    exchange: IHttpExchange<RequestType, ResponseType>;
    response: AttachedResponseType
}
