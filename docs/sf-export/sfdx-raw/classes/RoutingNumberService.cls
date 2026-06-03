public inherited sharing class RoutingNumberService {
    @AuraEnabled
    public static RoutingNumberResponse validateRoutingNumber(String routingNumber, String accountId) {
        RoutingNumberResponse response = new RoutingNumberResponse();
        response.isValid = false;
        if (String.isBlank(routingNumber) || routingNumber.length() != 9) {
            response.isValid = false;
            response.message = 'Routing number must be 9 digits long.';
        } else {
            RoutingNumberRequest createClientRequest = constructRequest(routingNumber);
            String requestBody = JSON.serialize(createClientRequest, true);
            System.HttpResponse apiResponse = SASApi.doCalloutWithJSONBody(requestBody, 'ValidateRoutingNumber', accountId, false);
            ProcessorWrapper.API_Response result = SASApi.parseResponse(apiResponse, null, null); 
            if (result != null && result.isSuccess == true) {
                response.isValid = true;
                response.message = 'Routing number is valid.';
            } else {
                response.isValid = false;
                response.message = 'Routing number is invalid.';
            }
        }
        return response;
    }

    private static RoutingNumberRequest constructRequest(String routingNumber) {
        RoutingNumberRequest req = new RoutingNumberRequest();
        req.BankRoutingNumber = routingNumber;
        return req;
    }

    public class RoutingNumberRequest {
        public String BankRoutingNumber;    
    }

    public class RoutingNumberResponse {
        @AuraEnabled
        public Boolean isValid{get;set;}
        @AuraEnabled
        public String message{get;set;}
    }
}