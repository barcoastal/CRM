/**
 * @Description: Hander class to process the functionality on draftTrigger which extends TriggerHandler.
 * This class is used to calculate and create the Debit Schedule records
 */
public without sharing class DraftTriggerHandler extends TriggerHandler {

    private Map<Id, Draft__c> draftsOldMap;
    public static Boolean bypassPopulateSyncPending = false;

    public DraftTriggerHandler() {
        this.draftsOldMap = (Map<Id, Draft__c>) Trigger.oldMap;
    }

    public override void beforeInsert() {
        populateSyncPending();
    }

    public override void beforeUpdate() {
        populateSyncPending();
    }

    /**
     * @description: Method to execute logic in the after insert trigger event.
     */
    public override void afterInsert() {
        filterDraftsForDebitSchedule(Trigger.new);
        checkFirstPaymentComplete(Trigger.new);
        DraftAfterTriggerHelper.calculatePaymentSummaries();
        DraftFeesService.upsertChildFees();
        getStatusChangedDrafts(Trigger.new);
    }

    /**
     * @description: Method to execute logic in the after update trigger event.
     */
    public override void afterUpdate() {
        filterDraftsForDebitSchedule(Trigger.new);
        checkFirstPaymentComplete(Trigger.new);
        getStatusChangedDrafts(Trigger.new);
        DraftAfterTriggerHelper.calculatePaymentSummaries();
        DraftFeesService.upsertChildFees();
    }
    
    /**
     * @description: Method to execute logic in the after delete trigger event.
     */
    public override void afterDelete() {
        filterDraftsForDebitSchedule(Trigger.old);
        DraftAfterTriggerHelper.calculatePaymentSummaries();
        DraftFeesService.upsertChildFees();  
    }
    
    /**
    * @description: Method will check first payment completed checkbox in opportunity when first payment status as completed in draft.
    **/
    private void checkFirstPaymentComplete(List<Draft__c> draftList) {
    
        Map<Id,List<Draft__c>> completedDrafts = new Map<Id, List<Draft__c>>();
        Map<Id,List<Draft__c>> stageUpdatedDrafts = new Map<Id, List<Draft__c>>();
        
        if (draftList != null && !draftList.isEmpty()) {
            for (Draft__c draft : draftList) {
                if(draft.Program_Plan__c != null && draft.Draft_Status__c != null && 
                   (Trigger.isInsert || draft.Draft_Status__c != this.draftsOldMap.get(draft.Id).Draft_Status__c) &&                
                   draft.Draft_Status__c == DraftUtil.STATUS_COMPLETED && draft.Draft_Date__c != null) {
                    if(completedDrafts.containsKey(draft.Program_Plan__c)){
                        completedDrafts.get(draft.Program_Plan__c).add(draft);
                    }else{
                        completedDrafts.put(draft.Program_Plan__c, new List<Draft__c>{draft});
                    }
                }            
                
                if(Trigger.isUpdate && draft.Program_Plan__c != null && draft.Draft_Status__c != null && 
                   draft.Draft_Status__c != this.draftsOldMap.get(draft.Id).Draft_Status__c && draft.Draft_Date__c != null) {
                    if(stageUpdatedDrafts.containsKey(draft.Program_Plan__c)){
                        stageUpdatedDrafts.get(draft.Program_Plan__c).add(draft);
                    }else{
                        stageUpdatedDrafts.put(draft.Program_Plan__c, new List<Draft__c>{draft});
                    }
                }          
            }
        }
        
        if (completedDrafts != null) {
            DraftService.updateOpportunityBasedOnFirstPaymentComplete(completedDrafts,this.draftsOldMap);
            DraftService.updatePaymentCountByStatus(completedDrafts);
        }
        
        if(stageUpdatedDrafts != null) { 
            DraftService.updatePaymentCountByStatus(stageUpdatedDrafts);           
        }
    }
    
    /**
    * @description: Method will update first draft date on Accouont When draft status changes.
    **/
    private void getStatusChangedDrafts(List<Draft__c> draftList) {
        
        Map<Id,List<Draft__c>> statusChangedDrafts = new Map<Id, List<Draft__c>>();
        for (Draft__c draft : draftList) {
            if(draft.Program_Plan__c != null && draft.Draft_Status__c != null && (Trigger.isInsert || 
                (Trigger.isUpdate && (draft.Draft_Date__c != this.draftsOldMap.get(draft.Id).Draft_Date__c || draft.Draft_Status__c != this.draftsOldMap.get(draft.Id).Draft_Status__c)))){
                if(statusChangedDrafts.containsKey(draft.Program_Plan__c)){
                    statusChangedDrafts.get(draft.Program_Plan__c).add(draft);
                }else{
                    statusChangedDrafts.put(draft.Program_Plan__c, new List<Draft__c>{draft});
                }
            }
        }
        
        if (statusChangedDrafts != null) {
            DraftService.updateFirstDraftDateOnAccount(statusChangedDrafts);
        }
    }

    private void filterDraftsForDebitSchedule(List<Draft__c> draftList) {

        Set<Id> programPlanIdSet = new Set<Id>();
        
        if (draftList != null && !draftList.isEmpty()) {
            for (Draft__c draft : draftList) {
                //Checking whether the draft amount or draft date changed
                if (draft.Draft_Total_Amount__c != null && draft.Draft_Date__c != null && 
                    draft.Program_Plan__c  != null && (
                    Trigger.isInsert || Trigger.isDelete || 
                    (Trigger.isUpdate && (
                        draft.Draft_Total_Amount__c != this.draftsOldMap.get(draft.Id).Draft_Total_Amount__c  || 
                        draft.Draft_Date__c != this.draftsOldMap.get(draft.Id).Draft_Date__c))
                )) {
                    programPlanIdSet.add(draft.Program_Plan__c);
                }
            }
        }

        if (!programPlanIdSet.isEmpty()) {
            DebitScheduleService.createDebitSchedule(programPlanIdSet);
        }
    }

    //Populating the Sync Status fields if the payment processor integration related fields are updated
    private static void populateSyncPending() {
        
        if (bypassPopulateSyncPending) {
            return;
        }
        
        for (Draft__c draftRecord : (List<Draft__c>)Trigger.new) {
            if (Trigger.isInsert) {
                draftRecord.Sync_Status__c = 'Sync Pending';
            } else if (Trigger.isUpdate) {
                Draft__c oldDraftRecord = (Draft__c)Trigger.oldMap.get(draftRecord.Id);
                for (Schema.SObjectField sObjField : DraftWrapper.draftFields) {
                    if (draftRecord.get(sObjField) != oldDraftRecord.get(sObjField)) {
                        draftRecord.Sync_Status__c = 'Sync Pending';
                        break;
                    }
                }
                if (draftRecord.Draft_Status__c != oldDraftRecord.Draft_Status__c && (draftRecord.Draft_Status__c == DraftUtil.STATUS_CANCELLED || draftRecord.Draft_Status__c == DraftUtil.STATUS_SKIPPED)) {
                    draftRecord.Sync_Status__c = 'Sync Pending';
                }
            }
        }
    }
}