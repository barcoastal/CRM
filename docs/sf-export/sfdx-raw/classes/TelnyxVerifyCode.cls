public without sharing class TelnyxVerifyCode {
    private static final String TELNYX_MDT_DEV_NAME = 'Send_Telnyx_Verification';
    
    public class InputRequest {
        @InvocableVariable(required=false)
        public String phoneNumber;

        @InvocableVariable(required=false)
        public String code;
        
        @InvocableVariable(required=false)
        public String verifyProfileId;
    }

    @InvocableMethod(label='Send Telnyx SMS' description='Sends an SMS via Telnyx')
    public static List<String> verifyCode(List<InputRequest> requests) {
        String responseBody = '';
        List<Telnyx_SMS_Configuration__mdt> configurationRecords = TelnyxSmsConfigurationData.getTelnyxConfig(TELNYX_MDT_DEV_NAME);
        
        if(configurationRecords.isEmpty() && !Test.isRunningTest()) {
        	return new List<String>{ 'Error', 'No configuration found' };
        }
        
        if (requests.isEmpty()) {
            return new List<String>{ 'Error', 'No requests provided' };
        }
        
        Map<String, Object> payload = new Map<String, Object> {
            'code'   => requests[0].code,
            'verify_profile_id' => requests[0].verifyProfileId
        };
        String body = JSON.serialize(payload);

        HttpRequest httpReq = new HttpRequest();
        String endpoint = '',token='';
        if(!Test.isRunningTest()) {
        	endpoint = configurationRecords[0].Endpoint__c.replace('{{phoneNumber}}', requests[0].phoneNumber);
            token = configurationRecords[0].Token__c;
        } else {
            endpoint = 'https://api.telnyx.com/v2/verifications/by_phone_number/'+  requests[0].phoneNumber + '/actions/verify';
            token = 'REDACTED_TELNYX_KEYo75kBVximnxu7yf5I12';
        }
        httpReq.setEndpoint(endpoint); 
        httpReq.setMethod('POST');
        httpReq.setHeader('Content-Type', 'application/json');
        httpReq.setHeader('Authorization', 'Bearer ' + token);
        httpReq.setBody(body);
            
        try {
            HttpResponse res = new Http().send(httpReq);
            TelnyxResponseWrapper responseWrapper = (TelnyxResponseWrapper)
                JSON.deserialize(res.getBody(), TelnyxResponseWrapper.class);
            responseBody = JSON.serialize(responseWrapper);
        } catch (Exception ex) {
            responseBody = ex.getMessage();
        }
        return new List<String>{responseBody};
    }
}