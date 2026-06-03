public with sharing class Batch_PopulateOutboundANIFields implements Database.Batchable<SObject>, Database.AllowsCallouts, Database.stateful{
    Id campaignId;
    public static Integer batchSize = 20;
    
    public static void PopulateOutboundANIFields(Id campaignId) {
        PopulateOutboundANIFields(campaignId,batchSize);
    }

    public static void PopulateOutboundANIFields(Id campaignId,Integer batchSizeParam) {
        Batch_PopulateOutboundANIFields batchInstance = new Batch_PopulateOutboundANIFields(campaignId); 
        batchInstance.campaignId = campaignId;
        Database.executeBatch(batchInstance, batchSizeParam);
    }

    
    public Batch_PopulateOutboundANIFields(Id campaignId) {
        this.campaignId = campaignId;
    }
    
    public Database.QueryLocator start(Database.BatchableContext bc) {
        Id preLeadRTId = LeadUtil.getRecordTypeId(LeadUtil.RT_PRE_LEAD);
        return Database.getQueryLocator('SELECT Id, Phone, Email, LeadId, Lead.RecordTypeId FROM CampaignMember WHERE (lead.Outbound_ANI_Identifier__c = Null OR lead.Outbound_ANI_From__c = null) AND Phone != Null AND Lead.RecordTypeId =: preLeadRTId AND CampaignId = :campaignId');
    }

    public void execute(Database.BatchableContext bc, List<CampaignMember> scope) {
        try{
            Set<Id> leadIds = new Set<Id>();
            for (CampaignMember campaignMemberRecord : scope) {
                leadIds.add(campaignMemberRecord.LeadId);
            }

            if(!leadIds.isEmpty()){
                OutboundAniService.doCallout(leadIds);
            }
        }catch(Exception ex){
            ApplicationLogger.logException(ex, campaignId);
        }
    }

    public void finish(Database.BatchableContext bc) {
        List<AggregateResult> leadsCountWithoutOutboundAni = CampaignData.campaingLeadsWithoutOutboundANI(campaignId);
        Campaign campaignRecord = New Campaign();
        campaignRecord.Id = campaignId;
        campaignRecord.Leads_Without_OutboundAnI_Populated__c = leadsCountWithoutOutboundAni[0] != Null?Integer.valueOf(leadsCountWithoutOutboundAni[0].get('leadsCount')):0;
        update campaignRecord;
        Batch_ConvertCampaignMembersIntoLeads.appendLeadsAndAddToFive9(campaignId);
    }
}