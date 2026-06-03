/*----------------------------------------------------------------
    Author: Vignesh
    Description: A generic class to contain the methods and variables for the http api call
    Test Class: HttpClient_Test

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    July-26-2023    Vignesh                  Initial Development                
--------------------------------------------------------------------*/
public inherited sharing class HttpClient {
    
    public enum Methods {
        GET,
        POST
    }

    public Methods method;
    public String endpoint;
    public String requestBody;
    public DOM.Document bodyDocument;
    public Map<String, String> headerMap;
    public Integer timeout;
    public HttpRequest constructedRequest;
    public Id recordId;
    //Added calloutStatement
    public String calloutStatement;
    public Map<String, String> keyWordsToReplaceMap;

    /**
     * @description: A public method to be called to initiate the API call
     * @returnType: HttpResponseWrapper - A wrapper class for the HTTP response
    */
    public HttpResponseWrapper sendRequest() {
        HttpResponseWrapper responseWrap;
        if (method != null && String.isNotBlank(endpoint)) {
            HttpRequest request = createHttpRequest();
            constructedRequest = request;
            responseWrap = send(request);
        }
        return responseWrap;
    }

    /**
     * @description: A method to construct the http request
     * @returnType: HttpRequest - A HTTP request to be sent to the external system
    */
    private HttpRequest createHttpRequest() {
        HttpRequest req = new HttpRequest();
        req.setMethod(method.name());
        req.setEndpoint(endpoint);
        if (String.isNotBlank(requestBody)) {
            req.setBody(requestBody);
        }
        if (bodyDocument != null) {
            req.setBodyDocument(bodyDocument);
        }
        if (timeout != null && timeout > 0) {
            req.setTimeout(timeout);
        }
        if (headerMap != null && !headerMap.isEmpty()) {
            for (String key :headerMap.keySet()) {
                req.setHeader(key, headerMap.get(key));
            }
        }
        return req;
    }

    /**
     * @description: A method to do the api call
     * @returnType: HttpResponseWrapper - A wrapper class for the HTTP response
    */
    private HttpResponseWrapper send(HttpRequest request) {
        Http httpCall = new Http();
        System.debug('Endpoint---->'+request.getEndpoint());
        System.debug('Method---->'+request.getMethod());
        System.debug('request---->'+request);
        HttpResponse response = httpCall.send(request);
        System.debug('response---->'+response);
        if (response.getStatusCode() >= 200 && response.getStatusCode() < 300) {
            ApplicationLogger.createCalloutSuccessInstance(endpoint, constructedRequest, response, calloutStatement, recordId);
        } else {
            ApplicationLogger.createCalloutFailureInstance(endpoint, constructedRequest, response, calloutStatement, recordId);
        }
        return new HttpResponseWrapper(response);
    }

    public class HttpResponseWrapper {
        public HttpResponse baseResponse;

        public HttpResponseWrapper(HttpResponse baseResponse) {
            this.baseResponse = baseResponse;
        }

        private String getBodyString() {
            return this.baseResponse.getBody();
        }

        /**
     * @description: A method to format the response string to replace the reserved keywords in apex
     * @returnType: String - The formatted response string
    */
        public String getFormattedResponseBody() {
            String responseBody = getBodyString();
            if (String.isNotBlank(responseBody)) {
                responseBody = responseBody.replace('"limit":','"limitValue":');
            }
            return responseBody;
        }
    }
}