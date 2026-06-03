/*----------------------------------------------------------------
    Author: Vignesh
    Description: This class contains all the task object related methods
    Test Class: TaskUtil_Test

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    June-18-2023    Vignesh                  Initial Development                100%
    
--------------------------------------------------------------------*/

public inherited sharing class TaskUtil extends SObjectUtilHelper implements SObjectUtil {
    private static final Schema.DescribeSObjectResult TASK_DESCRIBE = Schema.SObjectType.Task;
    public static final String RT_SMS = 'SMS';
    public static final String RT_DISPOSITION = 'Disposition';
    public static final String RT_ACTIVITY = 'Activity';
    public static final String RT_SYSTEM_ACTIVITY = 'System_Activity';
    public static final String RT_CHECKLIST_ITEM = 'Checklist_Item';
    public static final Id RTID_DISPOSITION = ApexUtil.getRecordTypeIdbyDeveloperName('Task', RT_DISPOSITION);
    public static final String RT_NOTE = 'Note';
    public static final String COMPLETED_STATUS = 'Completed';

    public static final String TASK_STATUS_FAILED = 'Failed';
    public static final String TASK_STATUS_COMPLETED = 'Completed';
    public static final String TASK_STATUS_PENDING = 'Pending';
    public static final String TASK_TYPE_CALL = 'Call';
 
    public String getSObjName() {
        return TASK_DESCRIBE.getName();
    }

    public String getSObjLabel() {
        return TASK_DESCRIBE.getLabel();
    }

    //Retrieve the field set details based on the fieldset name.
    public List<FieldSetDetails> getFieldsetDetails(String fieldsetName) {
        List<FieldSetDetails> fieldsetDetailsList = new List<FieldSetDetails>();
        Map<String, FieldSet> fieldSets = TASK_DESCRIBE.fieldSets.getMap();
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
        Map<String, Schema.RecordTypeInfo> recordTypeMap = TASK_DESCRIBE.getRecordTypeInfosByDeveloperName();
        if (recordTypeMap.containsKey(recordTypeName)) {
            recordTypeId = recordTypeMap.get(recordTypeName).getRecordTypeId();
        }
        return recordTypeId;
    }
}