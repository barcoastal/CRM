/*----------------------------------------------------------------
Author: Vinitha 
Description: Update draft based on external Id from SAS 
Test Class: 

History
<Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
Apr-25-2024      Vinitha                      Initial Development            81%  
--------------------------------------------------------------------*/

@RestResource(urlMapping='/v1/updateSASDetails/*')
global without sharing class SASInboundAPI{ 

    public static final String API_CALL_NAME = 'Draft Update';
    public Static Map<String, String> draftStatusMap = new Map<String, String>();
     
    @HttpPatch
    global static SASInboundAPIResponse updateDraft() {
    
        try {    
            RestRequest req = RestContext.request;
            SASInboundAPIResponse res = new SASInboundAPIResponse();  
            if(req.requestbody != null){
                Map<String, Object> params=(Map<String, Object>)JSON.deserializeUntyped(req.requestbody.toString());
                String draftId, draftExternalSASId;
                Set<String> draftStatus = new Set<String>(System.Label.SAS_Draft_Status.Split(','));
                
                if(params.containsKey('debit_remoteid')){
                    draftId = String.valueOf(params.get('debit_remoteid'));
                } else if(params.containsKey('debits_id')){
                    draftExternalSASId = String.valueOf(params.get('debits_id'));
                } 
                     
                if((draftId != null || draftExternalSASId != null) && params.containsKey('paymentstatus')){
                    Inbound_API_Log__c  inboundLog = new Inbound_API_Log__c();
                    inboundLog.Endpoint__c = 'v1/updateSASDetails - Patch';
                    inboundLog.Request_Body__c = req.requestbody.toString().length() >= 10000 ? req.requestbody.toString().substring(0, 10000) : req.requestbody.toString();
                    Database.SaveResult srData = Database.insert(inboundLog, false);
                    if(!srData.isSuccess()) {
                        String errorMessage;
                        for (Database.Error err : srData.getErrors()) {
                            ApplicationLogger.logDMLException(
                            'Inbound Log fields that affected this error : ' + String.join(err.getFields(), ', '), 
                            srData.getId(), err.getStatuscode() + ': ' + err.getMessage()
                            );
                        }
                    } else if(draftStatus.contains(String.valueOf(params.get('paymentstatus')))){                        
                        Map<String,String> sasMapFields =new Map<String,String>();
                        Map<String, String> newParams=new  Map<String, String>();                        
                        Inbound_API_Log__c inboundAPI = InboundAPILogData.queryInboundLogData(inboundLog.Id);
                        List<SASInboundAPIMapping__mdt> sasInboundMappings = SASInboundAPIMappingData.querySASInboundBasedOnAPICallName(API_CALL_NAME);                    
                        if(sasInboundMappings !=null && sasInboundMappings.size()>0) {
                            for(SASInboundAPIMapping__mdt sasMap :sasInboundMappings) {
                                sasMapFields.put(sasMap.SAS_Attribute_Name__c, sasMap.SF_Field_Name__c);
                            }
                        }              
                        
                        for(String fieldName : params.keySet()) {
                            String val = sasMapFields.get(fieldName);
                            if(String.isNotBlank(val)) {
                                newParams.put(val,string.valueOf(params.get(fieldName)));
                            }
                        }
                        
                        for(SAS_Payment_Status_Mapping__mdt paymentMap :[SELECT Id, Label, SF_Draft_Status__c, SAS_Draft_Status__c FROM SAS_Payment_Status_Mapping__mdt WHERE SF_Draft_Status__c != null AND SAS_Draft_Status__c != null]){
                            draftStatusMap.put(paymentMap.SAS_Draft_Status__c, paymentMap.SF_Draft_Status__c);
                        }
                        
                        List<Draft__c> payments = new List<Draft__c>();
                        if(draftId != '' && draftId != null){
                            payments = DraftData.queryDraftByIds(new Set<String>{draftId});
                        }else if(draftExternalSASId != '' && draftExternalSASId != null){
                            payments = DraftData.queryDraftBySASIds(new Set<String>{draftExternalSASId});
                        }
                        
                        if(payments !=null && payments.size()>0) {
                            Draft__c payment = payments[0];
                            for(String fieldName : newParams.keySet()) {
                                if(fieldName == 'Draft_Status__c' && draftStatusMap.containsKey(newParams.get(fieldName))) {
                                    payment.put(fieldName, draftStatusMap.get(newParams.get(fieldName)));
                                }else{
                                    payment.put(fieldName, newParams.get(fieldName));
                                } 
                            }  
                            if (payment != null) {
                                Database.SaveResult saveResult = Database.update(payment); 
                                if(!saveResult.isSuccess()) {
                                    String errorMessage;
                                    for (Database.Error err : saveResult.getErrors()) {
                                        errorMessage += err.getMessage() + '. ';
                                    }                            
                                    res.isSuccess = false;
                                    res.message = 'Unexpected error occurred. Please reach out your salesforce system administrator';
                                    ApplicationLogger.logDMLException('Draft update is failed', inboundLog.Id, errorMessage, true);
                                }else{
                                    res.isSuccess = true;
                                    res.message = 'The details are updated successfully';                            
                                }
                                res.jobId = inboundAPI.Name;
                                inboundLog.Response_Body__c = res.toString().length() >= 500 ? res.toString().substring(0, 500) : res.toString();
                                inboundLog.Draft__c = payment.Id;
                                update inboundLog;                        
                            }
                        }              
                    }            
                }else{
                    res.isSuccess = false;
                    res.message = 'Required fields are missing.';
                    ApplicationLogger.logDebugInfo('Required fields are missing.', null);
                }
            } 
            return res;      
        }catch(Exception ex) {
            SASInboundAPIResponse res = new SASInboundAPIResponse();
            res.isSuccess = false;
            res.message = 'Unexpected error occurred. Please reach out your salesforce system administrator';
            res.jobId = '';
            ApplicationLogger.logDebugInfo('Unexpected error occurred. Please reach out your salesforce system administrator', null);
            return res;
        }
    }
    
    global class SASInboundAPIResponse {
        global Boolean isSuccess;
        global String message;
        global String jobId; 
    }
    }