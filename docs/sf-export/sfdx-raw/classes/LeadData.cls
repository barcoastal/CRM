public inherited sharing class LeadData {
    public static List<Lead> queryLeadRecordType(Id leadId) {
        return [SELECT Id, RecordTypeId, RecordType.DeveloperName, Status, Sub_Disposition__c FROM Lead WHERE Id = :leadId];
    }

    public static List<Lead> queryLeadDetails(Id leadId, List<String> leadFields) {
        String query = 'SELECT ' + String.join(leadFields, ',') + ' FROM Lead WHERE Id = :leadId';
        return Database.query(query);
    }

    public static List<Lead> queryLeads(Set<Id> leadIds, List<String> leadFields) {
        String query = 'SELECT ' + String.join(leadFields, ',') + ' FROM Lead WHERE Id IN:leadIds';
        return Database.query(query);
    }

    public static List<RecordType> queryRecordTypes(String recordTypeName) {
        return [SELECT Id, DeveloperName FROM RecordType WHERE SobjectType = 'Lead' AND DeveloperName = :recordTypeName];
    }

    public static List<Lead> queryLeadsPhoneNumbers(Id leadId) {
        return [SELECT Id, Phone, MobilePhone, Work_Phone__c,DNC__c FROM Lead WHERE Id = :leadId];
    }
	
	public static List<Lead> queryLeadRecords(Set<Id> recordIds) {
        return [SELECT Id, Phone, PostalCode,DNC__c FROM Lead WHERE Id IN :recordIds];
    }

    /**
     * @description: method to query the lead record with the Id and list of lead fields.
     * @param1: Id leadId - Id of the lead record to be queried
     * @param2: Set<String> fields - the collection of the lead fields to be queried
     * @returnType: List<Lead>
    */
    public static List<Lead> queryLead(Id leadId, Set<String> fields) {
        List<String> fieldsList = new List<String>(fields);
        String fieldString = String.join(fieldsList, ', ');
        String query = 'SELECT ' + fieldString + ' FROM Lead WHERE Id = :leadId';
        return Database.query(query);
    }

    //Method to return the list of lead records using a dynamic query based on the field names and lead Ids
    public static List<Lead> getLeadList(List<Object> fieldNameList, Set<Id> leadIdSet) {
        if (fieldNameList != null && !fieldNameList.isEmpty() && leadIdSet != null && !leadIdSet.isEmpty()) {
            String query = 'SELECT ' + String.join(fieldNameList, ', ') + ' FROM Lead WHERE Id = :leadIdSet';   
            return Database.query(query);
        }
        return null;
    }
        
    public static List<Lead> queryIndividualLeadRecords(Set<Id> individualIds) {
        return [SELECT Id, IndividualId,Lead_Source_Category__c,LastModifiedDate FROM Lead WHERE IndividualId IN :individualIds AND status != :LeadUtil.LEAD_ARCHIVED_STATUS AND IsConverted = false];
    }
    
    public static List<Lead> queryIndividualLeadRecords(List<Individual> individualsList) {
        return [SELECT Id, IndividualId,Lead_Source_Category__c,LastModifiedDate FROM Lead WHERE IndividualId IN :individualsList AND status != :LeadUtil.LEAD_ARCHIVED_STATUS AND IsConverted = false];
    }

    public static List<Lead> qureyLeadsWithSamePhone(Set<String> phoneToLeadMap,List<Lead> processedLeads){
        return [SELECT Id , Name ,phone FROM Lead WHERE Phone IN : phoneToLeadMap AND Id NOT IN: processedLeads];
    }  
    
    public static List<Lead> queryLeadsWithoutIndividualReference(Set<String> phoneNumberSet) {
         String mdtFieldsList = fetchLeadFieldsMappingMdt();

        return new List<Lead>((List<Lead>) Database.query( 'SELECT  Id, Phone, Formated_Phone__c,OwnerId,LeadSource,Status,Alternate_Email__c, '+ mdtFieldsList +' FROM Lead WHERE Formated_Phone__c IN : phoneNumberSet AND IndividualId = null '));
    }    

    public static Map<Id,Lead> queryActiveleadOfIndividuals(Set<Id> activeLeadIds){
        String mdtFieldsList = fetchLeadFieldsMappingMdt();
        return new Map<Id,Lead>((List<Lead>) Database.query('SELECT Id,Phone,OwnerId,LeadSource,Lead_Source_Category__c,Status,Alternate_Email__c, '+ mdtFieldsList +' FROM Lead WHERE Id IN: activeLeadIds '));
    }
    
    public static List<Lead> queryActiveleadOfIndividuals(List<Lead> activeLeads){
        String mdtFieldsList = fetchLeadFieldsMappingMdt();
        return new List<Lead>((List<Lead>) Database.query('SELECT Id,Phone,OwnerId,LeadSource,Lead_Source_Category__c,Status,Alternate_Email__c, '+ mdtFieldsList +' FROM Lead WHERE Id IN: activeLeads '));
    }

    private static String fetchLeadFieldsMappingMdt() {
        Set<String> fetchLeadFieldsMappingMdt = new Set<String>();
        for (Append_Leads_Mapping__mdt mapping : AppendLeadsMappingData.queryAppendLeadsMappingForBatch()) {
            fetchLeadFieldsMappingMdt.add(mapping.Target_Field__c);
        }
        return  String.join(new List<String>(fetchLeadFieldsMappingMdt),',');
    }

    public static List<String> getReshuffleLeadsQueryMdtForBatchClass(){
        List<String> subDispositionQueryStringList = new List<String>();
        String WeekDay = ApexUtil.getWeekDay(date.today());
        for(Reshuffle_Leads_Querys__mdt mdt : [SELECT Id,Query__c,DeveloperName FROM Reshuffle_Leads_Querys__mdt]){
            // If it's Monday
            if (WeekDay == 'Monday') {
                subDispositionQueryStringList.add(mdt.Query__c);
            }else if (mdt.DeveloperName != 'No_Answer_Web_Lead' && mdt.DeveloperName != 'Never_Answered_Web_Lead') {
                subDispositionQueryStringList.add(mdt.Query__c);
            }
        }
        return subDispositionQueryStringList;
    }
    
    public static List<Lead> getLeadByPhoneAndLeadSource(String fromPhone, String LeadSource) {
       return [SELECT Id, ConvertedOpportunityId FROM Lead WHERE Formated_Phone__c =: fromPhone 
               AND LeadSource =: LeadSource ORDER BY CreatedDate Desc LIMIT 1];
    }
    
    public static Map<Id,Lead> queryLeadMapByIds(Set<Id> leadIds){
         return new Map<Id,Lead>([SELECT Id,Ad_Click_Id__c FROM Lead WHERE Id IN :leadIds]);
    }

    public static List<Lead> queryLeadsByIds(Set<Id> leadIds) {
        return [SELECT Id, Lead_Source_Category__c, Formated_Phone__c, Ad_Click_Id__c, LeadSource FROM Lead WHERE Id IN :leadIds];
    }

    public static List<Lead> getLeadsByPhoneNumbers(Set<String> phoneNumbers, Set<Id> excludeLeadIds) {
        return [SELECT Id, Lead_Source_Category__c, Formated_Phone__c FROM Lead WHERE Formated_Phone__c IN :phoneNumbers
            AND RecordTypeId = :LeadUtil.getRecordTypeId(LeadUtil.RT_WEB_LEAD)
            AND Status IN ('Working Lead', 'New') AND Id NOT IN :excludeLeadIds
        ];
    }

    public static List<Lead> getLeadsByLeadIds(Set<Id> leadIds) {
        return [SELECT Id, Lead_Source_Category__c, Formated_Phone__c FROM Lead WHERE Id IN :leadIds];
    }

    
    public static List<lead> getLeadsByLeadId(Set<String> leadIds){
        return [SELECT Id,Lead_Id__c FROM Lead WHERE Lead_Id__c IN: leadIds ];
    }
}