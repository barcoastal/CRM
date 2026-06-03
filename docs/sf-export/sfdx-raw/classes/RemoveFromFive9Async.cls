/*----------------------------------------------------------------
    Author: Vignesh P
    Description: A Service class to remove the Leads from Five9 in a Async mode
    Test Class: 

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Aug-05-2024     Vignesh                  Initial Development                
--------------------------------------------------------------------*/
public inherited sharing class RemoveFromFive9Async {

    /**
     * Author: Vignesh P
     * Description: A method to initiate the remove leads from five9 operation based on the phone number.
    */
    @future
    public static void removeLeadsFromFive9(Map<String, String> phoneNumberOperationTypeMap, Set<Id> leadIds) {
        try {
            if (!phoneNumberOperationTypeMap.isEmpty()) {
                Set<Id> relatdLeadIds = findRelatedLeadsByPhoneNumber(phoneNumberOperationTypeMap.keySet(), leadIds);
                if (!relatdLeadIds.isEmpty()) {
                    if (leadIds == null) {
                        leadIds = new Set<Id>();
                    }
                    leadIds.addAll(relatdLeadIds);
                }
                LeadServiceResult result = removeFromFive9(leadIds, null);
                processResults(result, phoneNumberOperationTypeMap, leadIds);
            }
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, null);
        }
    }

    /**
     * Author: Vignesh P
     * Description: A method to process the DML results of the remove from five9 operation.
    */
    private static void processResults(LeadServiceResult result, Map<String, String> phoneNumberOperationTypeMap, Set<Id> leadIds) {
        List<Async_Operation__c> asyncOperationList = new List<Async_Operation__c>();
        if (result.isSuccess == false) {
            if (result.exceptionDetails != null) {
                ApplicationLogger.logException(result.exceptionDetails, null);
            } else {
                ApplicationLogger.logExceptionHighSeverity('Remove Leads From Five9 Failed', null, result.customError);
            }
        } else {
            if (result.leadInstanceResult != null && !result.leadInstanceResult.isEmpty()) {
                for (LeadResult leadResult : result.leadInstanceResult.values()) {
                    System.debug('leadResult--->'+leadResult.additionalValues);
                    if (leadResult.additionalValues.containsKey('phoneNumber')) {
                        String leadPhoneNumber = leadResult.additionalValues.get('phoneNumber');
                        String operationType;
                        if (phoneNumberOperationTypeMap.containsKey(leadPhoneNumber)) {
                            operationType = phoneNumberOperationTypeMap.get(leadPhoneNumber);
                            Async_Operation__c asyncOperation = new Async_Operation__c();
                            asyncOperation.Record_Id__c = leadResult.leadId;
                            asyncOperation.Async_Type__c = (System.isBatch() ? 'Batch' : (System.isFuture() ? 'Future' : 'Queueable'));
                            asyncOperation.Lead__c = leadResult.leadId;
                            asyncOperation.Operation__c = operationType;
                            asyncOperation.Message__c = getMessage(leadResult);
                            asyncOperation.Status__c = String.isNotBlank(asyncOperation.Message__c) ? 'Failed' : 'Completed';
                            asyncOperationList.add(asyncOperation);
                        }
                    }
                }
                if (!asyncOperationList.isEmpty()) {
                    insert asyncOperationList;
                }
            }
        }
    }

    /**
     * Author: Vignesh P
     * Description: A method to extract the error message from the LeadService Result class
    */
    private static String getMessage(LeadResult leadResult) {
        String message;
        Database.UpsertResult dmlResult = leadResult.dmlResult;
        if (dmlResult != null && dmlResult.getErrors() != null && !dmlResult.getErrors().isEmpty()) {
            String errMessage = '';
            for (Database.Error err : dmlResult.getErrors()) {
                errMessage += err.getMessage() + '. ';
            }
            message = errMessage;
        }
        return message;
    }

    /**
     * Author: Vignesh P
     * Description: A method to fetch the duplicate leads who also have the same phone number 
    */
    private static Set<Id> findRelatedLeadsByPhoneNumber(Set<String> phoneNumbers, Set<Id> leadIds) {
        Set<Id> relatedLeadIds = new Set<Id>();
        String query = 'SELECT Id, Phone FROM Lead WHERE Phone IN :phoneNumbers AND Five9_List_Id__c != null ';
        if (leadIds != null && !leadIds.isEmpty()) {
            query += ' AND Id NOT IN :leadIds';
        }
        for (Lead relatedLead : Database.query(query)) {
            relatedLeadIds.add(relatedLead.Id);
        }
        return relatedLeadIds;
    }

    public static LeadServiceResult removeFromFive9(Set<Id> leadIds, Id five9ListId) {
        LeadServiceResult leadSvcResult = new LeadServiceResult();
        try {
            if (leadIds != null && !leadIds.isEmpty()) {
                leadSvcResult.leadInstanceResult = initiateRemoveFromFive9(leadIds, five9ListId);
            } else {
                leadSvcResult.isSuccess = false;
                leadSvcResult.customError = 'The input parameter Lead Ids collection is empty';
            }
        } catch(Exception ex) {
            leadSvcResult.isSuccess = false;
            leadSvcResult.customError = ex.getMessage();
            leadSvcResult.exceptionDetails = ex;
        }
        return leadSvcResult;
    }

    public static Map<Id, LeadResult> initiateRemoveFromFive9(Set<Id> leadIds, Id five9ListId) {
        Map<Id, LeadResult> leadSvcResultMap = new Map<Id, LeadResult>();
        List<Lead> leadsToUpsertList = new List<Lead>();
        for (Lead newLeadRec : queryNewLeads(leadIds)) {
            String five9ListIdTemp = five9ListId;
            if (String.isBlank(newLeadRec.Phone)) {
                LeadResult leadSvcResult = new LeadResult();
                leadSvcResult.leadId = newLeadRec.Id;
                leadSvcResult.isSuccess = false;
                leadSvcResult.customError = 'The phone number is blank in the lead.';
                leadSvcResultMap.put(newLeadRec.Id, leadSvcResult);
            } else {
                Lead leadToUpdate = new Lead();
                leadToUpdate.Id = newLeadRec.Id;
                leadToUpdate.Phone = newLeadRec.Phone;
                if (String.isBlank(five9ListIdTemp) && String.isNotBlank(newLeadRec.Five9_List_Id__c)) {
                    five9ListIdTemp = newLeadRec.Five9_List_Id__c;
                }
                if (String.isNotBlank(five9ListIdTemp)) {
                    removeFromFive9(leadToUpdate, five9ListIdTemp);
                    leadsToUpsertList.add(leadToUpdate);
                } else {
                    LeadResult leadSvcResult = new LeadResult();
                    leadSvcResult.leadId = newLeadRec.Id;
                    leadSvcResult.isSuccess = false;
                    leadSvcResult.customError = 'Five9 List Id is blank in Lead Record.';
                    leadSvcResultMap.put(newLeadRec.Id, leadSvcResult);
                }
            }
        }
        if (!leadsToUpsertList.isEmpty()) {
            dmlLeadsToUpsertList(leadsToUpsertList, leadSvcResultMap);
        }
        return leadSvcResultMap;
    }

    @testVisible
    private static List<Lead> queryNewLeads(Set<Id> leadIds) {
        String fieldsToBeQueried;
        Set<String> newLeadFields = new Set<String> {'Id', 'Phone', 'Append_Leads_Counter__c', 'Email', 'Five9_List_Id__c','Archived_Date__c','Is_Archived__c'};
        if (existingLeadVsNewLeadFieldsMap != null && !existingLeadVsNewLeadFieldsMap.isEmpty()) {
            newLeadFields.addAll(existingLeadVsNewLeadFieldsMap.values());
        }
        fieldsToBeQueried = String.join(newLeadFields, ',');
        return Database.query('SELECT ' + fieldsToBeQueried + ' FROM Lead WHERE Id IN :leadIds');
    }

    private static void removeFromFive9(Lead leadRec, Id five9ListId) {
        if (String.isNotBlank(five9ListId)) {
          //  leadRec.Delete_from_f9list_id__c = five9ListId;
          //  leadRec.Five9_List_Id__c = null;
          leadRec.Is_Archived__c = True;
          leadRec.Archived_Date__c = date.Today();
        }
    }

    private static Map<String, String> existingLeadVsNewLeadFieldsMap = fetchExistingLeadVsNewLeadFieldsMap();

    private static void dmlLeadsToUpsertList(List<Lead> leadsToUpsertList, Map<Id, LeadResult> leadSvcResultMap) {
        Integer counter = 0;
        for (Database.UpsertResult upsertResult : Database.upsert(leadsToUpsertList, false)) {
            Lead leadRecord = leadsToUpsertList[counter];
            LeadResult leadSvcResult = new LeadResult();
            leadSvcResult.leadId = leadRecord.Id;
            leadSvcResult.additionalValues.put('phoneNumber', leadRecord.Phone);
            leadSvcResult.dmlResult = upsertResult;
            if (!upsertResult.isSuccess()) {
                leadSvcResult.isSuccess = false;
            }
            leadSvcResultMap.put(leadRecord.Id, leadSvcResult);
            counter++;
        }
    }

    private static Map<String, String> fetchExistingLeadVsNewLeadFieldsMap() {
        Map<String, String> existLeadVsNewLeadFieldsMap = new Map<String, String>();
        for (Append_Leads_Mapping__mdt mapping : AppendLeadsMappingData.queryAppendLeadsMapping()) {
            existLeadVsNewLeadFieldsMap.put(mapping.Source_Field__c, mapping.Target_Field__c);
        }
        return existLeadVsNewLeadFieldsMap;
    }

    public class LeadServiceResult {
        public Boolean isSuccess;
        public String customError;
        public Exception exceptionDetails;
        public Map<Id, LeadResult> leadInstanceResult;

        public LeadServiceResult() {
            this.isSuccess = true;
        }

        public LeadServiceResult(String customError) {
            this.isSuccess = false;
            this.customError = customError;
        }
    }

    public class LeadResult {
        public Id leadId;
        public Boolean isSuccess;
        public String customError;
        public Map<String, String> additionalValues;
        public Database.UpsertResult dmlResult;

        public LeadResult() {
            this.isSuccess = true;
            this.additionalValues = new Map<String, String>();
        }

        public LeadResult(String customError) {
            this.isSuccess = false;
            this.customError = customError;
        }
    }
}