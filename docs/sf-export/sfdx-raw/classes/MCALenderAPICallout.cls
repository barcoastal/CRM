public inherited sharing class MCALenderAPICallout implements Queueable, Database.AllowsCallouts {

    private List<Id> leadIds;

    public MCALenderAPICallout(List<Id> leadIds) {
        this.leadIds = leadIds;
    }
    
    public void execute(QueueableContext context) { 
        Id leadId;   
        List<String> leadFields = new List<String>{'Sub_Disposition__c', 'five9_Disposition__c', 'Lead_Source_Category__c', 'FirstName', 'LastName', 'Phone', 'Email', 'Company', 'Lead_Id__c', 'Street','City', 'State', 'PostalCode'};    
        Set<Id> leadIdSet = new Set<Id>{};
        leadIdSet.addAll(leadIds);
        try {
            List<Lead> leads = LeadData.queryLeads(leadIdSet, leadFields);
            for(Lead leadRec : leads){
                leadId = leadRec.Id;
                MCALenderWrapper mcaWrap = new MCALenderWrapper(leadRec);
                Map<String, Object> untypedMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(mcaWrap));
                String requestBody = CitadelUtil.constructRequest(untypedMap, MCALenderWrapper.createMCALenderMap);
                doCallout(requestBody, leadRec.Id);
            }            
        }catch(Exception exp) {
            ApplicationLogger.logException(exp, leadId);
        }    
    }
       
   private static void doCallout(String requestBody, String leadId) {
       HttpClient httpClientInst = new HttpClient();
       HttpClient.HttpResponseWrapper responseWrapper;
       try {
           httpClientInst.method = HttpClient.Methods.POST;
           httpClientInst.endpoint = new MCALenderSettings().endpoint;
           httpClientInst.requestBody = requestBody;
           httpClientInst.timeout = 120000;
           Map<String, String> headerMap = new Map<String, String> ();
           headerMap.put('Content-Type', 'application/x-www-form-urlencoded');
           httpClientInst.headerMap = headerMap;
           responseWrapper = httpClientInst.sendRequest();
           String calloutResponse = responseWrapper.baseResponse.getBody();
           if(responseWrapper.baseResponse.getStatusCode() == 200 && calloutResponse.contains('Success:')){
                Lead leadRec = new Lead();
                leadRec.Id = leadId;
                leadRec.MCA_Lender_External_Id__c = calloutResponse.split(':')[1];
                Update leadRec;
            }
           ApplicationLogger.logCalloutSuccess(httpClientInst.endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Callout request sent to MCA Lender', leadId);
       } catch(System.Exception exp) { 
           ApplicationLogger.logCalloutException(httpClientInst.endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, exp, leadId);
       }
   }
}