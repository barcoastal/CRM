/*----------------------------------------------------------------
    Author: Vinitha
    Description: A batch share the leads to MCA lender via API callout.
    Test Class: 

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Mar-05-2024     Vinitha                 Initial Development                 75%
--------------------------------------------------------------------*/
public without sharing class Batch_ShareLeadToMCA implements Database.Batchable<SObject>, Database.AllowsCallouts, Database.Stateful {
    
    public String query = '';
    MCA_Lender_Settings__c mcaInstance = MCA_Lender_Settings__c.getInstance();
    public DateTime last_run_time = (mcaInstance != null && mcaInstance.Last_Run_Time__c != null) ? mcaInstance.Last_Run_Time__c : System.now().addHours(-1); // replace with custom setting value. 
    public String endPoint = (mcaInstance != null && mcaInstance.Endpoint__c != null) ? mcaInstance.Endpoint__c : '';
    public List<String> MCA_LENDER_SUB_DISPOSITION = System.Label.MCA_Lender_SubDispositions.split(',');
    public List<String> MCA_LENDER_FIVE9_DISPOSITION = System.Label.MCA_Lender_Five9Disposition.split(',');
    public DateTime lastRunTime;
    public String filterCondition;
    
    public Batch_ShareLeadToMCA(){
        this.query = 'SELECT Id, Sub_Disposition__c, five9_Disposition__c, Lead_Source_Category__c, FirstName, LastName, Phone, Email, Company, Lead_Id__c, Street, City, State, PostalCode FROM Lead WHERE (Sub_Disposition__c IN :MCA_LENDER_SUB_DISPOSITION OR five9_Disposition__c IN :MCA_LENDER_FIVE9_DISPOSITION) AND lastModifiedDate >=:last_run_time AND MCA_Lender_External_Id__c = NULL';
    }
    
    public Batch_ShareLeadToMCA(DateTime lastRunTime){ 
        this.lastRunTime = lastRunTime; 
        this.query = 'SELECT Id, Sub_Disposition__c, five9_Disposition__c, Lead_Source_Category__c, FirstName, LastName, Phone, Email, Company, Lead_Id__c, Street, City, State, PostalCode FROM Lead WHERE (Sub_Disposition__c IN :MCA_LENDER_SUB_DISPOSITION OR five9_Disposition__c IN :MCA_LENDER_FIVE9_DISPOSITION) AND lastModifiedDate >=:lastRunTime AND MCA_Lender_External_Id__c = NULL';
    }
    
    public Batch_ShareLeadToMCA(String filterCondition){
        this.filterCondition = filterCondition;    
        this.query = 'SELECT Id, Sub_Disposition__c, five9_Disposition__c, Lead_Source_Category__c, FirstName, LastName, Phone, Email, Company, Lead_Id__c, Street, City, State, PostalCode FROM Lead '+ filterCondition;
    }
    
    public Database.QueryLocator start(Database.BatchableContext bc){
        
        //String query = 'SELECT Id, Sub_Disposition__c, five9_Disposition__c, Lead_Source_Category__c, FirstName, LastName, Phone, Email, Company, Lead_Id__c, Street, City, State, PostalCode FROM Lead WHERE (Sub_Disposition__c IN :MCA_LENDER_SUB_DISPOSITION OR five9_Disposition__c IN :MCA_LENDER_FIVE9_DISPOSITION) AND lastModifiedDate >=:last_run_time AND MCA_Lender_External_Id__c = NULL';
        return Database.getQueryLocator(query);
    } 
    
    // Execute method to update redial time and delete from f9list id on Lead.
    public void execute(Database.BatchableContext bc, List<Lead> scope) { 
        Id leadId;               
        List<Lead> updateLeads = new List<Lead>();                 
        try {
            if(endPoint != null && endPoint != ''){
            for(Lead leadRec : scope){
                leadId = leadRec.Id;
                MCALenderWrapper mcaWrap = new MCALenderWrapper(leadRec);
                Map<String, Object> untypedMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(mcaWrap));
                String requestBody = CitadelUtil.constructRequest(untypedMap, MCALenderWrapper.createMCALenderMap);
                    String mcaExternalId = doCallout(requestBody, leadRec.Id, endPoint);
                    if(mcaExternalId != null && mcaExternalId != '') {
                        Lead leadInstance = new Lead();
                        leadInstance.Id = leadId;
                        leadInstance.MCA_Lender_External_Id__c = mcaExternalId;
                        updateLeads.add(leadInstance); 
                    }
                }
                    
                for (Database.SaveResult saveResult : Database.update(updateLeads, false)) {
                    if (!saveResult.isSuccess()) {
                        String errorMessage;
                        for (Database.Error err : saveResult.getErrors()) {
                            errorMessage += err.getMessage() + '. ';
                        }
                        ApplicationLogger.logDMLException('Updating lead with MCA Lender External Id is failed', saveResult.getId(), errorMessage, true);
                    }                
                } 
            }            
        }catch(Exception exp) {
            ApplicationLogger.logException(exp, leadId);
        } 
    }
    
    public void finish(Database.BatchableContext bc) {
        //Update batch last run time in sync redial time custom setting
        MCA_Lender_Settings__c mcaRunTime = [SELECT Id, Last_Run_Time__c FROM MCA_Lender_Settings__c];
        mcaRunTime.Last_Run_Time__c = System.now();
        UPDATE mcaRunTime;
    }
    
    private static String doCallout(String requestBody, String leadId, String endPoint) {
       HttpClient httpClientInst = new HttpClient();
       HttpClient.HttpResponseWrapper responseWrapper;
       String externalId = '';
       try {
           httpClientInst.method = HttpClient.Methods.POST;
           httpClientInst.endpoint = endPoint;
           httpClientInst.requestBody = requestBody;
           httpClientInst.timeout = 120000;
           Map<String, String> headerMap = new Map<String, String> ();
           headerMap.put('Content-Type', 'application/x-www-form-urlencoded');
           httpClientInst.headerMap = headerMap;
           responseWrapper = httpClientInst.sendRequest();
           String calloutResponse = responseWrapper.baseResponse.getBody();
           if(responseWrapper.baseResponse.getStatusCode() == 200 && calloutResponse.contains('Success:')){
               externalId = calloutResponse.split(':')[1];                
           }           
           ApplicationLogger.logCalloutSuccess(httpClientInst.endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, 'Callout request sent to MCA Lender', leadId);
           return externalId;
       } catch(System.Exception exp) { 
           ApplicationLogger.logCalloutException(httpClientInst.endpoint, httpClientInst.constructedRequest, responseWrapper.baseResponse, exp, leadId);
           return externalId;
       }
   }
}