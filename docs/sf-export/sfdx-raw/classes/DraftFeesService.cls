public inherited sharing class DraftFeesService {

    public static Boolean byPassDraftFeesUpdateCriteria = false;
    
    public static void upsertChildFees() { 
        Map<Id, Set<String>> draftIdFeeTypeMap = new Map<Id, Set<String>>();
        Map<Id, Draft__c> draftIdDraftMap = new Map<Id, Draft__c>();
        Set<Id> draftRecordsToDeleteChildFees = new Set<Id>();

        if(Trigger.isInsert || Trigger.isUpdate){
            for (Draft__c draftRecord : (List<Draft__c>)Trigger.new) {
                if (Trigger.isInsert) {
                    handleInsertScenario(draftRecord, draftIdFeeTypeMap, draftIdDraftMap);
                } else if (Trigger.isUpdate) {
                    handleUpdateScenario(draftRecord, draftIdFeeTypeMap, draftIdDraftMap);
                }
            }
        }
        if (!draftIdFeeTypeMap.isEmpty()) {
            populateUniqueudsToExistingFees(draftIdFeeTypeMap.keySet());
            FeeUtil.fetchFeesRecordTypeIds();
            List<Fee__c> feesToUpsertList = new List<Fee__c>();
            Set<String> feeUniqueIdsToDelete = new Set<String>();
            for (Id draftId : draftIdFeeTypeMap.keySet()) {
                for (String feeType : draftIdFeeTypeMap.get(draftId)) {
                    Draft__c draftInstance = draftIdDraftMap.get(draftId);
                    Fee__c feeToDML = createFee(draftInstance, feeType);
                    if (feeToDML.Fee_Amount__c > 0) {
                        feesToUpsertList.add(feeToDML);
                    } else {
                        feeUniqueIdsToDelete.add(feeToDML.Unique_Id__c);
                    }
                }
            }
            if (!feeUniqueIdsToDelete.isEmpty()) {
                List<Fee__c> feesToDeleteList = new List<Fee__c>();
                for (Fee__c feeRecord : [SELECT Id FROM Fee__c WHERE Unique_Id__c IN :feeUniqueIdsToDelete]) {
                    feesToDeleteList.add(feeRecord);
                }
                delete feesToDeleteList;
            }
            upsert feesToUpsertList Unique_Id__c;

        }
    }
    
    private static void handleInsertScenario(Draft__c draftRecord, Map<Id, Set<String>> draftIdFeeTypeMap, Map<Id, Draft__c> draftIdDraftMap) {
        for (String feeType : FeeUtil.FEE_TYPES) {
            String feeFieldName = FeeUtil.getFeeFieldNameInDraft(feeType);
            if (draftRecord.get(feeFieldName) != null && (Decimal)draftRecord.get(feeFieldName) > 0) {
                if (!draftIdFeeTypeMap.containsKey(draftRecord.Id)) {
                    draftIdFeeTypeMap.put(draftRecord.Id, new Set<String>());
                }
                draftIdFeeTypeMap.get(draftRecord.Id).add(feeType);
                if (!draftIdDraftMap.containsKey(draftRecord.Id)) {
                    draftIdDraftMap.put(draftRecord.Id, draftRecord);
                }
            }
        }
    }
    private static void handleUpdateScenario(Draft__c draftRecord, Map<Id, Set<String>> draftIdFeeTypeMap, Map<Id, Draft__c> draftIdDraftMap) {
        Draft__c oldDraftRecord = (Draft__c)Trigger.oldMap.get(draftRecord.Id);
        for (String feeType : FeeUtil.FEE_TYPES) {
            String feeFieldName = FeeUtil.getFeeFieldNameInDraft(feeType);
            if (byPassDraftFeesUpdateCriteria == true || draftRecord.get(feeFieldName) != oldDraftRecord.get(feeFieldName) || draftRecord.Draft_Status__c != oldDraftRecord.Draft_Status__c) {
                if (!draftIdFeeTypeMap.containsKey(draftRecord.Id)) {
                    draftIdFeeTypeMap.put(draftRecord.Id, new Set<String>());
                }
                draftIdFeeTypeMap.get(draftRecord.Id).add(feeType);
                if (!draftIdDraftMap.containsKey(draftRecord.Id)) {
                    draftIdDraftMap.put(draftRecord.Id, draftRecord);
                }
            }
        }
    }
    private static Fee__c createFee(Draft__c draftInstance, String feeType) {
        Fee__c feeRecord = new Fee__c();
        feeRecord.Unique_Id__c = constructFeeUniqueId(draftInstance.Id, feeType); 
        feeRecord.RecordTypeId = FeeUtil.FEE_TYPE_RT_ID_MAP.get(feeType);
        feeRecord.Draft__c = draftInstance.Id;
        feeRecord.Program_Plan__c = draftInstance.Program_Plan__c;
        feeRecord.Account__c = draftInstance.Account__c;
        feeRecord.Fee_Date__c = draftInstance.Draft_Date__c;
        feeRecord.Fee_Amount__c = (Decimal)draftInstance.get(FeeUtil.getFeeFieldNameInDraft(feeType));
        feeRecord.Fee_Status__c = draftInstance.Draft_Status__c;
        return feeRecord;
    }
    public static String constructFeeUniqueId(Id draftId, String feeType) {
        return draftId + '-' + feeType;
    }
    private static void populateUniqueudsToExistingFees(Set<Id> draftIds) {
        if (draftIds != null && !draftIds.isEmpty()) {
            List<Fee__c> feesToUpdate = new List<Fee__c>();
            for (Fee__c feeRecord : [SELECT Id, Unique_Id__c, Draft__c, RecordType.DeveloperName FROM Fee__c WHERE Draft__c IN :draftIds AND Unique_Id__c = null]) {
                Fee__c feeToUpdate = new Fee__c();
                feeToUpdate.Id = feeRecord.Id;
                feeToUpdate.Unique_Id__c = constructFeeUniqueId(feeRecord.Draft__c, feeRecord.RecordType.DeveloperName);
                feesToUpdate.add(feeToUpdate);
            }
            update feesToUpdate;
        }
    }
}