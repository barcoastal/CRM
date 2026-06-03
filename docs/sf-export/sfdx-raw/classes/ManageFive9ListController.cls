/*----------------------------------------------------------------
    Author: Dharanya Sekar
    Description: A Controller class to manage the five9 list appendLeads&AddToFive9/activation/deactivation in compaign.
    * This is invoked from the lwc component "manageFive9List" from the aura quick action.
    * It updates the campaign status to AppendLead&AddToFive9/activation/deactivation in progress.
    * Then it invokes the batch to query all related leads and add the five9 list in the leads.
    Test Class: ManageFive9ListControllerTest

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Dec-07-2023     Dharanya Sekar          Initial Development                 100%
    Apr-28-2024     Vignesh Ponnusamy       Updates to include Append Leads     100%
--------------------------------------------------------------------*/
public without sharing class ManageFive9ListController {

    //Method to retrieve the campaign record based on the campaignId from the lwc component
    @AuraEnabled
    public static Campaign getCampaignData(Id campaignId) {
        List<Campaign> campaignList = CampaignData.queryCampaign(campaignId);
        return !campaignList.isEmpty() ? campaignList[0] : null;
    }

    //Method to invoke batch to perform the job Append Leads and Add to Five, Add to Five9 and Remove from Five9
    @AuraEnabled
    public static void updateCampaignWithStatus(Id campaignId, String jobType, Id five9ListId) {
        if (campaignId != null) {
            populateCampaignStatus(campaignId, jobType);
            if (jobType == 'AppendLeadAndAddToFive9') {
                Batch_PopulateOutboundANIFields.PopulateOutboundANIFields(campaignId);
                // Batch_ConvertCampaignMembersIntoLeads.appendLeadsAndAddToFive9(campaignId);
            } else if (jobType == 'AddToFive9') {
                Batch_ConvertCampaignMembersIntoLeads.addLeadsToFive9(campaignId);
            } else if (jobType == 'RemoveFromFive9') {
                Batch_ConvertCampaignMembersIntoLeads.removeLeadsFromFive9(campaignId);
            }
        }
    }

    //Method to update the campaign status based on the job type
    private static void populateCampaignStatus(Id campaignId, String jobType) {
        Campaign campaignToUpdate = new Campaign();
        campaignToUpdate.Id = campaignId;
        if (jobType == 'AppendLeadAndAddToFive9') {
            campaignToUpdate.Status = 'Append Lead and Activation in progress';
        } else if (jobType == 'AddToFive9') {
            campaignToUpdate.Status = 'Activation in Progress';
        } else if (jobType == 'RemoveFromFive9') {
            campaignToUpdate.Status = 'Deactivation in Progress';
        } 
        update campaignToUpdate;
    }
}