export interface IHttpExchange<RequestType, ResponseType> {
    request: RequestType;
    response: ResponseType;
}
