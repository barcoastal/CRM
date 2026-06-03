public inherited sharing class EventUtil extends SObjectUtilHelper implements SObjectUtil {
    private static final Schema.DescribeSObjectResult EVENT_DESCRIBE = Schema.SObjectType.EVENT;
    public static final String RT_EVENT = 'Event';
    public static final String RT_EVENT_DISPOSITION = 'Event_Disposition';

    public String getSObjName() {
        return EVENT_DESCRIBE.getName();
    }

    public String getSObjLabel() {
        return EVENT_DESCRIBE.getLabel();
    }

    public List<FieldSetDetails> getFieldsetDetails(String fieldsetName) {
        List<FieldSetDetails> fieldsetDetailsList = new List<FieldSetDetails>();
        Map<String, FieldSet> fieldSets = EVENT_DESCRIBE.fieldSets.getMap();
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

    //Retrieve the record type Id based on the record type developer name
    public static Id getRecordTypeId(String recordTypeName) {
        Id recordTypeId;
        Map<String, Schema.RecordTypeInfo> recordTypeMap = EVENT_DESCRIBE.getRecordTypeInfosByDeveloperName();
        if (recordTypeMap.containsKey(recordTypeName)) {
            recordTypeId = recordTypeMap.get(recordTypeName).getRecordTypeId();
        }
        return recordTypeId;
    }
}