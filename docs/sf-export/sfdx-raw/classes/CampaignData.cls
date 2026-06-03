public inherited sharing class CampaignData {
    public static List<Campaign> queryCampaign(Id campaignId) {
        return [
            SELECT Id, Status, Five9_List_Id__c,Five9_lsp2_List_Id__c
            FROM Campaign 
            WHERE Id = :campaignId
        ];
    }

    public static List<AggregateResult> campaingLeadsWithoutOutboundANI(Id campaignId){
        Id preLeadRTId = LeadUtil.getRecordTypeId(LeadUtil.RT_PRE_LEAD);
        return [SELECT COUNT(Id) leadsCount FROM CampaignMember WHERE (lead.Outbound_ANI_Identifier__c = Null OR lead.Outbound_ANI_From__c = Null) AND Phone != Null AND Lead.RecordTypeId =: preLeadRTId AND CampaignId =: campaignId];
    }
}