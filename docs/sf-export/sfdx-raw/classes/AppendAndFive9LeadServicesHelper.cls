/**
 * Description: AppendAndFive9LeadServicesHelper class contains the reusuable methods for the Append Leads functionality and Five9 related functionalities
*/
public inherited sharing class AppendAndFive9LeadServicesHelper {

    public static Set<String> phoneNumbers = new Set<String>(); 

    private static Map<String, String> existingLeadVsNewLeadFieldsMap = fetchExistingLeadVsNewLeadFieldsMap();
   // private static final Id RT_BUSINESS_LEAD_ID = LeadUtil.getRecordTypeId(LeadUtil.RT_BUSINESS);
   private static final Id RT_LIST_LEAD_ID = LeadUtil.getRecordTypeId(LeadUtil.RT_LIST_LEAD);
   private static Integer hopperPriority;
    private static Set<String> dispositionsToExcludeInAppendLead = new Set<String>();
    private static Set<Id> nonPreLeadRTIds = LeadUtil.getLeadRTIds();

    private static Boolean appendLeadAddToFive9 = false;
    private static Boolean addToFive9 = false;
    private static Boolean removeFromFive9 = false;
    
    public static Map<Id, LeadService.LeadResult> initiateAppendLeadsAndAddToFive9(Set<Id> leadIds, Id five9ListId) {
        appendLeadAddToFive9 = true;
        Map<Id, LeadService.LeadResult> leadSvcResultMap = new Map<Id, LeadService.LeadResult>();
        Map<String, Lead> phoneNumberNewLeadMap = new Map<String, Lead>();
        Map<String, List<Lead>> phoneNumberExistingLeadMap = new Map<String, List<Lead>>();
        Set<Id> eligibleNewLeadIds = new Set<Id>();
        setAppendLeadConfigValues();
        for (Lead newLeadRec : queryNewLeads(leadIds)) {
            if (String.isBlank(newLeadRec.Formated_Phone__c)) {
                LeadService.LeadResult leadSvcResult = new LeadService.LeadResult();
                leadSvcResult.leadId = newLeadRec.Id;
                leadSvcResult.isSuccess = false;
                leadSvcResult.customError = 'The phone number is blank in the lead.';
                leadSvcResultMap.put(newLeadRec.Id, leadSvcResult);
            } else {
                if (phoneNumbers.contains(newLeadRec.Formated_Phone__c)) {
                    LeadService.LeadResult leadSvcResult = new LeadService.LeadResult();
                    leadSvcResult.leadId = newLeadRec.Id;
                    leadSvcResult.isSuccess = false;
                    leadSvcResult.customError = 'Duplicate Phone Number.';
                    leadSvcResultMap.put(newLeadRec.Id, leadSvcResult);
                } else {
                    phoneNumberNewLeadMap.put(newLeadRec.Formated_Phone__c, newLeadRec);
                    eligibleNewLeadIds.add(newLeadRec.Id);
                    phoneNumbers.add(newLeadRec.Formated_Phone__c);
                }
            }
        }
        if (!eligibleNewLeadIds.isEmpty()) {
            leadIds.clear();
            for (Lead existingLeadRec : queryExistingLeads(phoneNumberNewLeadMap.keySet(), eligibleNewLeadIds)) {
                if (!phoneNumberExistingLeadMap.containsKey(existingLeadRec.Formated_Phone__c)) {
                    phoneNumberExistingLeadMap.put(existingLeadRec.Formated_Phone__c, new List<Lead>());
                }
                phoneNumberExistingLeadMap.get(existingLeadRec.Formated_Phone__c).add(existingLeadRec);
            }
            List<Lead> leadsToUpsert = constructLeads(phoneNumberNewLeadMap, phoneNumberExistingLeadMap, five9ListId);
            dmlLeadsToUpsertList(leadsToUpsert, leadSvcResultMap);
        }
        return leadSvcResultMap;
    }

    public static Map<Id, LeadService.LeadResult> initiateAddToFive9(Set<Id> leadIds, Id five9ListId) {
        addToFive9 = true;
        Map<Id, LeadService.LeadResult> leadSvcResultMap = new Map<Id, LeadService.LeadResult>();
        List<Lead> leadsToUpsertList = new List<Lead>();
        for (Lead newLeadRec : queryNewLeads(leadIds)) {
            if (String.isBlank(newLeadRec.Formated_Phone__c)) {
                LeadService.LeadResult leadSvcResult = new LeadService.LeadResult();
                leadSvcResult.leadId = newLeadRec.Id;
                leadSvcResult.isSuccess = false;
                leadSvcResult.customError = 'The phone number is blank in the lead.';
                leadSvcResultMap.put(newLeadRec.Id, leadSvcResult);
            } else {
                if (phoneNumbers.contains(newLeadRec.Formated_Phone__c)) {
                    LeadService.LeadResult leadSvcResult = new LeadService.LeadResult();
                    leadSvcResult.leadId = newLeadRec.Id;
                    leadSvcResult.isSuccess = false;
                    leadSvcResult.customError = 'Duplicate Phone Number.';
                    leadSvcResultMap.put(newLeadRec.Id, leadSvcResult);
                } else {
                    Lead leadToUpdate = new Lead();
                    leadToUpdate.Id = newLeadRec.Id;
                    addToFive9(leadToUpdate, five9ListId);
                    leadsToUpsertList.add(leadToUpdate);
                }
            }
        }
        if (!leadsToUpsertList.isEmpty()) {
            dmlLeadsToUpsertList(leadsToUpsertList, leadSvcResultMap);
        }
        return leadSvcResultMap;
    }

    public static Map<Id, LeadService.LeadResult> initiateRemoveFromFive9(Set<Id> leadIds, Id five9ListId) {
        removeFromFive9 = true;
        Map<Id, LeadService.LeadResult> leadSvcResultMap = new Map<Id, LeadService.LeadResult>();
        List<Lead> leadsToUpsertList = new List<Lead>();
        for (Lead newLeadRec : queryNewLeads(leadIds)) {
            if (String.isBlank(newLeadRec.Formated_Phone__c)) {
                LeadService.LeadResult leadSvcResult = new LeadService.LeadResult();
                leadSvcResult.leadId = newLeadRec.Id;
                leadSvcResult.isSuccess = false;
                leadSvcResult.customError = 'The phone number is blank in the lead.';
                leadSvcResultMap.put(newLeadRec.Id, leadSvcResult);
            } else {
                Lead leadToUpdate = new Lead();
                leadToUpdate.Id = newLeadRec.Id;
                if (String.isBlank(five9ListId) && String.isNotBlank(newLeadRec.Five9_List_Id__c)) {
                    five9ListId = newLeadRec.Five9_List_Id__c;
                    removeFromFive9(leadToUpdate, five9ListId);
                    leadsToUpsertList.add(leadToUpdate);
                } else {
                    LeadService.LeadResult leadSvcResult = new LeadService.LeadResult();
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

    public static Map<Id, LeadService.LeadResult> archiveLeads(Set<Id> leadIds) {
        Map<Id, LeadService.LeadResult> leadSvcResultMap = new Map<Id, LeadService.LeadResult>();
        Map<String, Lead> phoneNumberNewLeadMap = new Map<String, Lead>();
        Map<String, List<Lead>> phoneNumberExistingLeadMap = new Map<String, List<Lead>>();
        Set<Id> eligibleNewLeadIds = new Set<Id>();
        List<Lead> leadsToUpsertList = new List<Lead>();
        for (Lead newLeadRec : queryNewLeads(leadIds)) {
            if (String.isBlank(newLeadRec.Formated_Phone__c)) {
                LeadService.LeadResult leadSvcResult = new LeadService.LeadResult();
                leadSvcResult.leadId = newLeadRec.Id;
                leadSvcResult.isSuccess = false;
                leadSvcResult.customError = 'The phone number is blank in the lead.';
                leadSvcResultMap.put(newLeadRec.Id, leadSvcResult);
            } else {
                phoneNumberNewLeadMap.put(newLeadRec.Formated_Phone__c, newLeadRec);
                eligibleNewLeadIds.add(newLeadRec.Id);
            }
        }
        if (!phoneNumberNewLeadMap.isEmpty()) {
            for (Lead existingLeadRec : queryExistingLeads(phoneNumberNewLeadMap.keySet(), eligibleNewLeadIds)) {
                if (!phoneNumberExistingLeadMap.containsKey(existingLeadRec.Formated_Phone__c)) {
                    phoneNumberExistingLeadMap.put(existingLeadRec.Formated_Phone__c, new List<Lead>());
                }
                phoneNumberExistingLeadMap.get(existingLeadRec.Formated_Phone__c).add(existingLeadRec);
            }
            leadsToUpsertList = constructArchiveLeads(phoneNumberNewLeadMap, phoneNumberExistingLeadMap);
        }
        if (!leadsToUpsertList.isEmpty()) {
            dmlLeadsToUpsertList(leadsToUpsertList, leadSvcResultMap);
        }
        return leadSvcResultMap;
    }

    @testVisible
    private static List<Lead> queryNewLeads(Set<Id> leadIds) {
        String fieldsToBeQueried;
        Set<String> newLeadFields = new Set<String> {'Id', 'Phone', 'Formated_Phone__c', 'Append_Leads_Counter__c', 'Email', 'Five9_List_Id__c','Archived_Date__c','Is_Archived__c'};
        if (existingLeadVsNewLeadFieldsMap != null && !existingLeadVsNewLeadFieldsMap.isEmpty()) {
            newLeadFields.addAll(existingLeadVsNewLeadFieldsMap.values());
        }
        fieldsToBeQueried = String.join(newLeadFields, ',');
        return Database.query('SELECT ' + fieldsToBeQueried + ' FROM Lead WHERE Id IN :leadIds');
    }

    @testVisible
    private static List<Lead> queryExistingLeads(Set<String> phoneNumbers, Set<Id> eligibleNewLeadIds) {
        String fieldsToBeQueried;
        Set<String> existingLeadFields = new Set<String> {'Id', 'Phone', 'Formated_Phone__c', 'Append_Leads_Counter__c', 'Five9_List_Id__c', 'Email', 'Status','Archived_Date__c','Is_Archived__c'};
        if (existingLeadVsNewLeadFieldsMap != null && !existingLeadVsNewLeadFieldsMap.isEmpty()) {
            existingLeadFields.addAll(existingLeadVsNewLeadFieldsMap.keySet());
        }
        fieldsToBeQueried = String.join(existingLeadFields, ',');
        String query = 'SELECT ' + fieldsToBeQueried + ' FROM Lead WHERE RecordTypeId IN :nonPreLeadRTIds AND Formated_Phone__c IN :phoneNumbers AND Id NOT IN :eligibleNewLeadIds ';
        query += ' AND (Sub_Disposition__c = null OR Sub_Disposition__c NOT IN :dispositionsToExcludeInAppendLead) ORDER BY LastModifiedDate DESC';
        return Database.query(query);
    }

    private static List<Lead> constructLeads(Map<String, Lead> phoneNumberNewLeadMap, Map<String, List<Lead>> phoneNumberExistingLeadMap, Id five9ListId) {
        List<Lead> leadsToUpsertList = new List<Lead>();
        String five9ListIdTemp = five9ListId;
        for (String phoneNumberValue : phoneNumberNewLeadMap.keySet()) {
            Lead newLead = phoneNumberNewLeadMap.get(phoneNumberValue);
            if (phoneNumberExistingLeadMap.containsKey(phoneNumberValue)) {
                Integer counter = 1;
                for (Lead existingLead : phoneNumberExistingLeadMap.get(phoneNumberValue)) {
                    Boolean eligibleForDML = false;
                    if (counter == 1) {
                        newLead = appendLead(newLead, existingLead);
                        existingLead.Lead_Appended_Timestamp__c = System.now();
                        eligibleForDML = true;
                    }
                    if (String.isBlank(five9ListIdTemp) && String.isNotBlank(existingLead.Five9_List_Id__c)) {
                        five9ListIdTemp = existingLead.Five9_List_Id__c;
                    }
                   /*if (String.isNotBlank(five9ListIdTemp)) {
                        removeFromFive9(existingLead, five9ListIdTemp);
                        eligibleForDML = true;
                    }
                    if (existingLead.Status != 'Archive Disposition') {
                        archiveExistingLead(existingLead);
                        eligibleForDML = true;
                    }*/
                    if (eligibleForDML == true) {
                leadsToUpsertList.add(existingLead);
            } 
                    counter++;
                }
            } 
            assignListLeadRecordTypeId(newLead);
            addToFive9(newLead, five9ListId);
            leadsToUpsertList.add(newLead);
        }
        return leadsToUpsertList;
    }

    private static List<Lead> constructArchiveLeads(Map<String, Lead> phoneNumberNewLeadMap, Map<String, List<Lead>> phoneNumberExistingLeadMap) {
        List<Lead> leadsToUpsertList = new List<Lead>();
        for (String phoneNumberValue : phoneNumberNewLeadMap.keySet()) {
            Lead newLead = phoneNumberNewLeadMap.get(phoneNumberValue);
            if (phoneNumberExistingLeadMap.containsKey(phoneNumberValue)) {
                for (Lead existingLead : phoneNumberExistingLeadMap.get(phoneNumberValue)) {
                    if (String.isNotBlank(existingLead.Five9_List_Id__c)) {
                    removeFromFive9(existingLead, existingLead.Five9_List_Id__c);
                    }
                    archiveExistingLead(existingLead);
                    leadsToUpsertList.add(existingLead);
                }
            }
            newLead.Archived_Duplicate_Leads__c = true;
            leadsToUpsertList.add(newLead);
        }
        return leadsToUpsertList;
    }

    private static Lead appendLead(Lead newLead, Lead existingLead) {
        if (existingLeadVsNewLeadFieldsMap != null && !existingLeadVsNewLeadFieldsMap.isEmpty()) {
            for (String sourceField : existingLeadVsNewLeadFieldsMap.keySet()) {
                String targetField = existingLeadVsNewLeadFieldsMap.get(sourceField);
                Object newValue = newLead.get(targetField);
                if (newValue == null) {
                    Object existingValue = existingLead.get(sourceField);
                    ApexUtil.typeCastValue(existingValue);
                    newLead.put(targetField, existingValue);
                }                
            }
        }
        newLead.Hopper_Priority__c = hopperPriority;
        newLead.Append_Leads_Counter__c = existingLead.Append_Leads_Counter__c != null ? (existingLead.Append_Leads_Counter__c + 1) : 1;
        if (existingLead.Email != newLead.Email) {
            newLead.Alternate_Email__c = existingLead.Email;
        }
        return newLead;
    }

    private static void archiveExistingLead(Lead existingLead) {
        existingLead.Status = 'Archive Disposition';
        existingLead.Sub_Disposition__c = 'Archived - Duplicate Lead';
    }

    private static void addToFive9(Lead leadRec, Id five9ListId) {
        if (String.isNotBlank(five9ListId)) {
            leadRec.Add_to_f9list_Id__c = five9ListId;
            leadRec.Five9_List_Id__c = five9ListId;
        }
    }

    private static void removeFromFive9(Lead leadRec, Id five9ListId) {
        if (String.isNotBlank(five9ListId)) {
            //leadRec.Delete_from_f9list_id__c = five9ListId;
            //leadRec.Five9_List_Id__c = null;
            leadRec.Is_Archived__c = true;
            leadRec.Archived_Date__c = date.Today();
        }
    }

    private static void assignListLeadRecordTypeId(Lead newLead) {
        newLead.RecordTypeId = RT_LIST_LEAD_ID;
    }

    private static void dmlLeadsToUpsertList(List<Lead> leadsToUpsertList, Map<Id, LeadService.LeadResult> leadSvcResultMap) {
        Integer counter = 0;
        System.debug('leadsToUpsertList---->'+leadsToUpsertList);
        for (Database.UpsertResult upsertResult : Database.upsert(leadsToUpsertList, false)) {
            Lead leadRecord = leadsToUpsertList[counter];
            if (upsertResult.isSuccess()) {
                LeadService.LeadResult leadSvcResult = new LeadService.LeadResult();
                leadSvcResult.leadId = leadRecord.Id;
                leadSvcResult.additionalValues.put('phoneNumber', leadRecord.Formated_Phone__c);
                if (appendLeadAddToFive9 == true) {
                    if (leadRecord.Append_Leads_Counter__c > 0) {
                        leadSvcResult.additionalValues.put(LeadUtil.UNIQUE_LEAD_CONVERSION, 'false');
                    } else {
                        leadSvcResult.additionalValues.put(LeadUtil.UNIQUE_LEAD_CONVERSION, 'true');
                    }
                }
                leadSvcResult.dmlResult = upsertResult;
                if (!upsertResult.isSuccess()) {
                    leadSvcResult.isSuccess = false;
                }
                leadSvcResultMap.put(leadRecord.Id, leadSvcResult);
            } else {
                String errorMessage = '';
                for (Database.Error err : upsertResult.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                ApplicationLogger.logDMLException('Append and Five9 Lead Services Helper', leadRecord.Id, errorMessage, true);
            }
            counter++;
        }
        ApplicationLOgger.insertStoredLogs();
    }

    private static Map<String, String> fetchExistingLeadVsNewLeadFieldsMap() {
        Map<String, String> existLeadVsNewLeadFieldsMap = new Map<String, String>();
        for (Append_Leads_Mapping__mdt mapping : AppendLeadsMappingData.queryAppendLeadsMapping()) {
            existLeadVsNewLeadFieldsMap.put(mapping.Source_Field__c, mapping.Target_Field__c);
        }
        return existLeadVsNewLeadFieldsMap;
    }

    private static void setAppendLeadConfigValues() {
        List<Append_Leads_Config__mdt> configs = AppendLeadsConfigData.queryAppendLeadsConfig();
        if (configs != null && !configs.isEmpty()) {   
            if (configs[0].Hopper_Priority__c != null) {
                hopperPriority = Integer.valueOf(configs[0].Hopper_Priority__c);
            } 
            if (String.isNotBlank(configs[0].Dispositions_to_Exclude__c)) {
                String dispositionToExcludeString = configs[0].Dispositions_to_Exclude__c;
                dispositionsToExcludeInAppendLead = new Set<String>(dispositionToExcludeString.split(',')); 
            }
        }
    }
}