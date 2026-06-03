public inherited sharing class OutboundAniService {
    private static final String FIELD_ROW_ID = 'row_id';
    private static final String FIELD_OUTBOUND_ANI = 'outboundani';
     private static final String FIELD_DATE_VALUE = '409b1bbd-abdd-4377-abef-e4bfdf416ced';
    private static final String FIELD_OUTBOUND_ANI_FROM = '43052dd1-b2e1-4e38-b607-b71daef3091b';
    private static final String FIELD_OUTBOUND_ANI_IDENTIFIER = '8b3f690b-0a7e-4b54-af6b-4783841a5d3d';

    public static void doCallout(Set<Id> recordIds) {
        HttpClient httpReq = new HttpClient();
        HttpClient.HttpResponseWrapper responseWrapper;
        String endpoint = '';
        
        try {
            endpoint =  OutboundAniSettingUtility.getEndPoint();
            httpReq.method = HttpClient.Methods.POST;
            httpReq.endpoint = endpoint;
            List<Lead> leadRecordsToProcess  = LeadData.queryLeadRecords(recordIds);
            httpReq.requestBody = constructRequest(leadRecordsToProcess);
            responseWrapper = httpReq.sendRequest();
            updateLeadRecordsBasedOnResult(responseWrapper.getFormattedResponseBody());
            ApplicationLogger.logCalloutSuccess(endpoint, httpReq.constructedRequest, responseWrapper.baseResponse, 'Callout request sent to Outbound ANI', null);
        } catch(Exception exp) { 
            System.debug(exp.getMessage());
            ApplicationLogger.logException(exp, null);
        }
    }
    @TestVisible
    private static void updateLeadRecordsBasedOnResult(String responseBody) {
        
        List<Object> responseList = (List<Object>) JSON.deserializeUntyped(responseBody);
        List<Lead> leadRecordsToUpdate = new List<Lead>();

        for(Object respObj : responseList) {
            Map<String, Object> leadObj = (Map<String, Object>) respObj;
            Lead leadRecord = new Lead();
            leadRecord.Id = getString(leadObj, FIELD_ROW_ID);
            leadRecord.Outbound_ANI__c = getString(leadObj, FIELD_OUTBOUND_ANI);
            leadRecord.Outbound_ANI_Date__c = Date.valueOf(getString(leadObj, FIELD_DATE_VALUE));
            leadRecord.Outbound_ANI_From__c = getString(leadObj, FIELD_OUTBOUND_ANI_FROM);
            leadRecord.Outbound_ANI_Identifier__c = getString(leadObj, FIELD_OUTBOUND_ANI_IDENTIFIER);            
            leadRecordsToUpdate.add(leadRecord);
        }
        update leadRecordsToUpdate;        
    }
    
    private static string constructRequest(List<Lead> leadRecords) {
        List<OutboundAniService.Inquiry> inquiries = new List<OutboundAniService.Inquiry>();
        for(Lead leadRecord : leadRecords) {
             inquiries.add(new OutboundAniService.Inquiry(leadRecord.Id, leadRecord.Phone, leadRecord.PostalCode));
        }
       //Passing Empty Campign Id yet to confirm since it optional
        OutboundAniRequest requestBody = new OutboundAniRequest(OutboundAniSettingUtility.getApiKey(),'', inquiries);
        return JSON.serialize(requestBody);
    }
    
    private static String getString(Map<String, Object> responseMap, String key) {
        if (responseMap != null && responseMap.containsKey(key) && responseMap.get(key) != null) {
            return String.valueOf(responseMap.get(key));
        }
        return null;
    }
    
    public class OutboundAniRequest {
        public String api_key;
        public String campaign_id;
        public List<Inquiry> json_inquiry;
        
        public OutboundAniRequest(String apiKey, String campaignId, List<Inquiry> inquiries) {
            api_key = apiKey;
            campaign_id = campaignId;
            json_inquiry = inquiries;
        }
    }
    
    public class Inquiry {
        public String row_id;
        public String prospect_phone;
        public String prospect_zip;
        
        public Inquiry(String rowId, String prospectPhone, String zip) {
            row_id = rowId;
            prospect_phone = prospectPhone;
            prospect_zip = zip;
        }
    }
}