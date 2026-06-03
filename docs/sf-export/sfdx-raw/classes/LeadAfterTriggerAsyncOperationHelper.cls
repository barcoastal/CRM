//Helper class for creating the async operations in the lead after trigger
public inherited sharing class LeadAfterTriggerAsyncOperationHelper {
    
    private static AsyncOperationUtil.ASYNC_TYPE_ENUM asyncType = getAsyncType();
    private static List<String> inboundLeadStaticValues = New List<String>{'Splashpage Inbound','Inbound'};
    
    public static void createAsyncOperationRecords() {
        if (Trigger.isAfter) {
            Set<Id> leadIdsEligibleForIPQualityScoreCheck = new Set<Id>();
            Map<Id, String> oppIdAdClickIdMap = new Map<Id, String>();
            List<String> five9LeadQualifiedDispositionList = New List<String>();
            for(Five9_Connector_Disposition__mdt five9Disposition: Five9CallLogData.getFive9LeadQualifiedDispositions()){
                five9LeadQualifiedDispositionList.add(five9Disposition.Label);
            }
         
            for (Lead leadInstance : (List<Lead>)Trigger.new) {
                if (Trigger.isInsert) {
                    validateCheckIpQualityScore(leadInstance, leadIdsEligibleForIPQualityScoreCheck);
                    createAsyncOpRedTrackLeadCreation(leadInstance);
                } else if (Trigger.isUpdate) {
                    createAsyncOpRedTrackLeadCreationAndQLOnAdClickIdUpdate(leadInstance, five9LeadQualifiedDispositionList, oppIdAdClickIdMap);
                    //createAsyncOpRedTrackInboundLeadCreation(leadInstance);
                    createAsyncOpRedTrackLeadQualification(leadInstance,five9LeadQualifiedDispositionList);
                } 
            }
            updateAdClickIdInOpportunitiesFromConvertedLeads(oppIdAdClickIdMap);
            createAsyncOpIpQualityScoreCheck(leadIdsEligibleForIPQualityScoreCheck);
        }
        Set<Id> asyncOpIdsUpserted = AsyncOperationUtil.dmlCachedAsyncOperations();
        if (asyncType == AsyncOperationUtil.ASYNC_TYPE_ENUM.FUTURE && asyncOpIdsUpserted != null && !asyncOpIdsUpserted.isEmpty()) {
            for (Id asyncOperationId : asyncOpIdsUpserted) {
                FutureHandler.processAsyncOperations(asyncOperationId);
            }
        }
    }

    private static void validateCheckIpQualityScore(Lead newLead, Set<Id> leadIdsEligibleForIPQualityScoreCheck) {
        if (String.isNotBlank(newLead.Phone)) {
            leadIdsEligibleForIPQualityScoreCheck.add(newLead.Id);
        }
    }

    private static void createAsyncOpRedTrackLeadCreation(Lead newLead) {
        if (String.isNotBlank(newLead.Ad_Click_Id__c)) {
            AsyncOperationUtil.createAsyncOperationRecord(newLead.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_LEAD_CREATION);
        }
    }
    
    /*private static void createAsyncOpRedTrackInboundLeadCreation(Lead newLead){
        Lead oldLead = (Lead)Trigger.oldMap.get(newLead.Id);
        if ((String.isBlank(oldLead.Ad_Click_Id__c) && String.isNotBlank(newLead.Ad_Click_Id__c)) && (!String.isBlank(newLead.LeadSource) && newLead.LeadSource.startsWith('IB'))){
           AsyncOperationUtil.createAsyncOperationRecord(newLead.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_INBOUND_LEAD_CREATION);
        }
    }*/

    private static void createAsyncOpIpQualityScoreCheck(Set<Id> leadIds) {
        if (!leadIds.isEmpty()) {
            for (Lead leadRecord : [SELECT Id, IndividualId FROM Lead WHERE Id IN :leadIds AND Individual.IPQS_Ready_to_Check__c = true]) {
                AsyncOperationUtil.createAsyncOperationRecord(leadRecord.IndividualId, asyncType, AsyncOperationUtil.OPERATION_IP_QUALITY_SCORE_CHECK);
            }
        }
    }

    private static void createAsyncOpRedTrackLeadQualification(Lead newLead,List<String> five9LeadQualifiedDispositionList) {
        if (String.isNotBlank(newLead.Ad_Click_Id__c)) {
            Lead oldLead = (Lead)Trigger.oldMap.get(newLead.Id);
            if (((newLead.Sub_Disposition__c != oldLead.Sub_Disposition__c && newLead.Sub_Disposition__c == 'Call Transferred from Fronter' && newLead.Status == 'Working Lead')
                || (newLead.five9_Disposition__c != oldLead.five9_Disposition__c && five9LeadQualifiedDispositionList.contains(newLead.five9_Disposition__c))) && (!String.isBlank(newLead.LeadSource) && newLead.LeadSource.startsWith('IB')) ) {
                AsyncOperationUtil.createAsyncOperationRecord(newLead.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_INBOUND_LEAD_QUALIFICATION);
            }
            else if ((newLead.Sub_Disposition__c != oldLead.Sub_Disposition__c && newLead.Sub_Disposition__c == 'Call Transferred from Fronter' && newLead.Status == 'Working Lead')
                || (newLead.five9_Disposition__c != oldLead.five9_Disposition__c && five9LeadQualifiedDispositionList.contains(newLead.five9_Disposition__c))) {
                AsyncOperationUtil.createAsyncOperationRecord(newLead.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_LEAD_QUALIFICATION);
            }
        }
    }
    
    private static void createAsyncOpRedTrackLeadCreationAndQLOnAdClickIdUpdate(Lead newLead, List<String> five9LeadQualifiedDispositionList, Map<Id, String> oppIdAdClickIdMap) {
        if (String.isNotBlank(newLead.Ad_Click_Id__c)) {
            Lead oldLead = (Lead)Trigger.oldMap.get(newLead.Id);
            if (newLead.Ad_Click_Id__c != oldLead.Ad_Click_Id__c && String.isBlank(oldLead.Ad_Click_Id__c)) {
                //Lead Creation Events
                if (String.isNotBlank(newLead.LeadSource) && newLead.LeadSource.startsWith('IB')) {
                    AsyncOperationUtil.createAsyncOperationRecord(newLead.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_INBOUND_LEAD_CREATION);
                } else {
                    AsyncOperationUtil.createAsyncOperationRecord(newLead.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_LEAD_CREATION);
                }
                //Lead Qualification Events
                if ((newLead.Sub_Disposition__c == 'Call Transferred from Fronter' && newLead.Status == 'Working Lead')
                    || (newLead.Status == 'Converted')
                    || (five9LeadQualifiedDispositionList.contains(newLead.five9_Disposition__c))
                ) {
                    if (String.isNotBlank(newLead.LeadSource) && newLead.LeadSource.startsWith('IB')) {
                        AsyncOperationUtil.createAsyncOperationRecord(newLead.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_INBOUND_LEAD_QUALIFICATION);
                    } else {
                        AsyncOperationUtil.createAsyncOperationRecord(newLead.Id, asyncType, AsyncOperationUtil.OPERATION_RED_TRACK_LEAD_QUALIFICATION);
                    }
                }

                if (newLead.convertedOpportunityId != null) {
                    oppIdAdClickIdMap.put(newLead.convertedOpportunityId, newLead.Ad_Click_Id__c);
                }
            }
        }
    }
    
    private static void updateAdClickIdInOpportunitiesFromConvertedLeads(Map<Id, String> opportunityIdAdClickIdMap) {
        if (!opportunityIdAdClickIdMap.isEmpty()) {
            List<Opportunity> oppsToDML = new List<Opportunity>();
            for (Id opportunityId : opportunityIdAdClickIdMap.keySet()) {
                Opportunity oppToUpdate = new Opportunity();
                oppToUpdate.Id = opportunityId;
                oppToUpdate.Ad_Click_Id__c = opportunityIdAdClickIdMap.get(opportunityId);
                oppsToDML.add(oppToUpdate);
            }
            update oppsToDML;
        }
    }
       
    private static AsyncOperationUtil.ASYNC_TYPE_ENUM getAsyncType() {
        if (System.isBatch() || System.isFuture()) {
            return AsyncOperationUtil.ASYNC_TYPE_ENUM.BATCH;
        }
        return Trigger.new.size() == 1  ? AsyncOperationUtil.ASYNC_TYPE_ENUM.FUTURE : AsyncOperationUtil.ASYNC_TYPE_ENUM.BATCH;
    }
}