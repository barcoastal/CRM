public inherited sharing class LeadUtil extends SObjectUtilHelper implements SObjectUtil{
    private static final Schema.DescribeSObjectResult LEAD_DESCRIBE = Schema.SObjectType.Lead;
    public static final String FIELD_DISPOSITION = 'Status';
    public static final String FIELD_SUB_DISPOSITION = 'Sub_Disposition__c';
    public static final String RT_BUSINESS = 'Business';
    public static final String RT_CONSUMER = 'Consumer';
    public static final String RT_PRE_LEAD = 'Pre_Lead';
    public static final String FIELD_CALL_TRANSFER_STATUS = 'Call_Transfer_Status__c';
    public static final String UNIQUE_LEAD_CONVERSION = 'Unique Lead';
    public static final String LEAD_ARCHIVED_STATUS = 'Archive Disposition';
    public static final String LEAD_NEW_STATUS = 'New';
    public static final String LEAD_SOURCE_WEB = 'Web';
     public static final String FAKE_DISPOSITION = 'Fake';
    public static final String LEAD_DIDNOT_REGISTER_DISPOSITION = 'Didnt Register';
	public static final String LEAD_FAKE_DISPOSITION = 'Fake Lead';
    public static final String LEAD_SOURCE_LIST = 'List Lead';
    public static final String RT_WEB_LEAD = 'Web_Lead';
    public static final String RT_LIST_LEAD = 'List_Lead';
    public static final String LEAD_SOURCE_AFFILIATE = 'Affiliate';

    public String getSObjName() {
        return LEAD_DESCRIBE.getName();
    }

    public String getSObjLabel() {
        return LEAD_DESCRIBE.getLabel();
    }

    public static Boolean isLeadId(Id sObjectId) {
        return ApexUtil.getSObjectName(sObjectId) == LEAD_DESCRIBE.getName();
    }

    //Retrieve the record type Id based on the record type developer name
    public static Id getRecordTypeId(String recordTypeName) {
        Id recordTypeId;
        Map<String, Schema.RecordTypeInfo> recordTypeMap = LEAD_DESCRIBE.getRecordTypeInfosByDeveloperName();
        if (recordTypeMap.containsKey(recordTypeName)) {
            recordTypeId = recordTypeMap.get(recordTypeName).getRecordTypeId();
        }
        return recordTypeId;
    }

    public static Lead getRTDetailsOfRecord(Id leadId) {
        List<Lead> leads = LeadData.queryLeadRecordType(leadId);
        if (!leads.isEmpty()) {
            return leads[0];
        }
        return null;
    }

    public List<FieldSetDetails> getFieldsetDetails(String fieldsetName) {
        List<FieldSetDetails> fieldsetDetailsList = new List<FieldSetDetails>();
        Map<String, FieldSet> fieldSets = LEAD_DESCRIBE.fieldSets.getMap();
        ApexUtil.requireValue('Field Set Name', fieldsetName);
        for (FieldSetMember field : fieldSets.get(fieldSetName).getFields()) {
            FieldSetDetails fieldsetDetail = new FieldSetDetails();
            fieldsetDetail.fieldName = field.getFieldPath();
            fieldsetDetail.fieldDescribe = field.getSObjectField().getDescribe();
            fieldsetDetail.fieldsetMemberDescribe = field;
            fieldsetDetailsList.add(fieldsetDetail);
        }
        return fieldsetDetailsList;
    }

    public static set<Id> getLeadRTIds() {
        Set<Id> leadRTIds = new Set<Id>();
        Id webLeadRTId = getRecordTypeId(RT_LIST_LEAD);
        Id ListLeadRTId = getRecordTypeId(RT_WEB_LEAD);
        leadRTIds.add(webLeadRTId);
        leadRTIds.add(ListLeadRTId);
        return leadRTIds;
    }

    public static Boolean appendLead(Lead sourceLead, Lead targetLead) {
        Boolean leadAppended = false;
        Map<String, String> existingLeadVsNewLeadFieldsMap = fetchExistingLeadVsNewLeadFieldsMap();
        if (existingLeadVsNewLeadFieldsMap != null && !existingLeadVsNewLeadFieldsMap.isEmpty()) {
            for (String sourceField : existingLeadVsNewLeadFieldsMap.keySet()) {
                String targetField = existingLeadVsNewLeadFieldsMap.get(sourceField);
                Object targetValue = targetLead.get(targetField);
                if (targetValue == null) {
                    Object sourcevalue = sourceLead.get(sourceField);
                    ApexUtil.typeCastValue(sourcevalue);
                    targetLead.put(targetField, sourcevalue);
                    leadAppended = true;
                }                
            }
        }
        //newLead.Hopper_Priority__c = hopperPriority;
        //newLead.Append_Leads_Counter__c = existingLead.Append_Leads_Counter__c != null ? (existingLead.Append_Leads_Counter__c + 1) : 1;
        if (targetLead.Email != sourceLead.Email) {
            targetLead.Alternate_Email__c = sourceLead.Email;
            leadAppended = true;
        }
        return leadAppended;
    }

    public static void constructLeadWithAppendLeadMappingMdt(Lead sourceLead, Lead targetLead) {
        Map<String, String> existingLeadVsNewLeadFieldsMap = fetchExistingLeadVsNewLeadFieldsMap();
        if (existingLeadVsNewLeadFieldsMap != null && !existingLeadVsNewLeadFieldsMap.isEmpty()) {
            for (String sourceField : existingLeadVsNewLeadFieldsMap.keySet()) {
                String targetField = existingLeadVsNewLeadFieldsMap.get(sourceField);
                Object targetValue = targetLead.get(targetField);
                    Object sourcevalue = sourceLead.get(sourceField);
                    ApexUtil.typeCastValue(sourcevalue);
                    targetLead.put(targetField, sourcevalue);
            }
        }
    }

    private static Map<String, String> fetchExistingLeadVsNewLeadFieldsMap() {
        Map<String, String> existLeadVsNewLeadFieldsMap = new Map<String, String>();
        for (Append_Leads_Mapping__mdt mapping : AppendLeadsMappingData.queryAppendLeadsMapping()) {
            existLeadVsNewLeadFieldsMap.put(mapping.Source_Field__c, mapping.Target_Field__c);
        }
        return existLeadVsNewLeadFieldsMap;
    }
}