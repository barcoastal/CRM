//Dedicated class for creating async operation records for opportunity
public inherited sharing class OpportunityAfterTriggerAsyncOpHelper {
    
    private static AsyncOperationUtil.ASYNC_TYPE_ENUM asyncType = getAsyncType();

    public static void createAsyncOperationRecords() {
        if (Trigger.isAfter) {
            for (Opportunity oppInstance : (List<Opportunity>)Trigger.new) {
                if (Trigger.isInsert) {
                    createAsyncOpRedTrackOpportunityCreation(oppInstance);
                } else if (Trigger.isUpdate) {
                    createAsyncOpRedTrackOpportunityCreationOnAdClickIdUpdate(oppInstance);
                    createAsyncOpRedTrackContractSent(oppInstance);
                    createAsyncOpRedTrackOpportunityClosedWon(oppInstance);
                    createAsyncOpRedTrackOpportunityFirstPayment(oppInstance);
                }
            }
        }
        Set<Id> asyncOpIdsUpserted = AsyncOperationUtil.dmlCachedAsyncOperations();
        if (asyncType == AsyncOperationUtil.ASYNC_TYPE_ENUM.FUTURE && asyncOpIdsUpserted != null && !asyncOpIdsUpserted.isEmpty()) {
            for (Id asyncOperationId : asyncOpIdsUpserted) {
                FutureHandler.processAsyncOperations(asyncOperationId);
            }
        }
    }

    private static void createAsyncOpRedTrackOpportunityCreation(Opportunity oppInstance) {
        if (String.isNotBlank(oppInstance.Ad_Click_Id__c)) {
            AsyncOperationUtil.createAsyncOperationRecord(oppInstance.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_CREATION);
        }
    }

    //Assumption: Ad Click Id should be sent before the contract sent stage
    private static void createAsyncOpRedTrackOpportunityCreationOnAdClickIdUpdate(Opportunity oppInstance) {
        if (String.isNotBlank(oppInstance.Ad_Click_Id__c)) {
            Opportunity oldOpportunity = (Opportunity)Trigger.oldMap.get(oppInstance.Id);
            if (oppInstance.Ad_Click_Id__c != oldOpportunity.Ad_Click_Id__c && String.isBlank(oldOpportunity.Ad_Click_Id__c)) {
                AsyncOperationUtil.createAsyncOperationRecord(oppInstance.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_CREATION);
                if (oppInstance.StageName == OpportunityUtil.STAGE_CONTRACT_SENT) {
                    AsyncOperationUtil.createAsyncOperationRecord(oppInstance.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_CONTRACT_SENT);
                }
                if (oppInstance.StageName == OpportunityUtil.STAGE_CLOSED_WON_PENDING) {
                    AsyncOperationUtil.createAsyncOperationRecord(oppInstance.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_CONTRACT_SENT);
                    AsyncOperationUtil.createAsyncOperationRecord(oppInstance.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_CLOSED_WON);
                }
                if (oppInstance.StageName == OpportunityUtil.STAGE_CLOSED_WON_COMPLETED) {
                    AsyncOperationUtil.createAsyncOperationRecord(oppInstance.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_CONTRACT_SENT);
                    AsyncOperationUtil.createAsyncOperationRecord(oppInstance.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_CLOSED_WON);
                    AsyncOperationUtil.createAsyncOperationRecord(oppInstance.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_FIRST_PAYMENT);
                }
            }
        }
    }

    private static void createAsyncOpRedTrackContractSent(Opportunity oppInstance) {
        if (String.isNotBlank(oppInstance.Ad_Click_Id__c)) {
            Opportunity oldOpportunity = (Opportunity)Trigger.oldMap.get(oppInstance.Id);
            if (oppInstance.StageName != oldOpportunity.StageName && oppInstance.StageName == OpportunityUtil.STAGE_CONTRACT_SENT) {
                AsyncOperationUtil.createAsyncOperationRecord(oppInstance.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_CONTRACT_SENT);
            }
        }
    }

    private static void createAsyncOpRedTrackOpportunityClosedWon(Opportunity oppInstance) {
        if (String.isNotBlank(oppInstance.Ad_Click_Id__c)) {
            Opportunity oldOpportunity = (Opportunity)Trigger.oldMap.get(oppInstance.Id);
            if (oppInstance.StageName != oldOpportunity.StageName && oppInstance.StageName == OpportunityUtil.STAGE_CLOSED_WON_PENDING) {
                AsyncOperationUtil.createAsyncOperationRecord(oppInstance.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_CLOSED_WON);
            }
        }
    }

    private static void createAsyncOpRedTrackOpportunityFirstPayment(Opportunity oppInstance) {
        if (String.isNotBlank(oppInstance.Ad_Click_Id__c)) {
            Opportunity oldOpportunity = (Opportunity)Trigger.oldMap.get(oppInstance.Id);
            if (oppInstance.StageName != oldOpportunity.StageName && oppInstance.StageName == OpportunityUtil.STAGE_CLOSED_WON_COMPLETED) {
                AsyncOperationUtil.createAsyncOperationRecord(oppInstance.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_OPPORTUNITY_FIRST_PAYMENT);
            }
        }
    }

    private static AsyncOperationUtil.ASYNC_TYPE_ENUM getAsyncType() {
        if (System.isBatch() || System.isFuture()) {
            return AsyncOperationUtil.ASYNC_TYPE_ENUM.BATCH;
        }
        return Trigger.new.size() == 1 ? AsyncOperationUtil.ASYNC_TYPE_ENUM.FUTURE : AsyncOperationUtil.ASYNC_TYPE_ENUM.BATCH;
    }
}