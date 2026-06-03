/*----------------------------------------------------------------
    Author: Dharanya Sekar
    Description: A batch class to manage the five9 list activation and deactivation in campaign and lead.
    Test Class: Batch_ManageFive9List_Test

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Dec-07-2023     Dharanya Sekar          Initial Development                 73%
    Feb-23-2024     Dharanya Sekar          Assign Five9 List in Lead           75%
--------------------------------------------------------------------*/
public without sharing class Batch_ManageFive9List implements Database.Batchable<SObject>, Database.Stateful {

    public Id campaignIdVar;
    public Boolean isActivatedVar;
    public Id five9ListIdVar;
    private Boolean hasError = false;

    public Batch_ManageFive9List(Id campaignId, Boolean isActivated, Id five9ListId) {
        this.campaignIdVar = campaignId;
        this.isActivatedVar = isActivated;
        this.five9ListIdVar = five9ListId;
    }

    // Start method to query the Lead records related to the Campaign.
    public Database.QueryLocator start(Database.BatchableContext bc){

        String query = 'SELECT Id, Add_to_f9list_Id__c, Delete_from_f9list_id__c, Five9_List_Id__c,Archived_Date__c,Is_Archived__c FROM Lead WHERE Id IN (SELECT LeadId FROM CampaignMember WHERE CampaignId = :campaignIdVar)';
        return Database.getQueryLocator(query);
    }

    // Execute method to update the Lead based on the Five9 List activation/deactivation in Campaign.
    public void execute(Database.BatchableContext bc, List<Lead> scope) {
		
        List<Lead> leadUpdatedList = new List<Lead>();
        
        for (Lead leadInstance : scope) {
            if (this.isActivatedVar) {
                leadInstance.Add_to_f9list_Id__c = this.five9ListIdVar;
                leadInstance.Five9_List_Id__c = this.five9ListIdVar;
            } else {
               // leadInstance.Delete_from_f9list_id__c = this.five9ListIdVar;
               // leadInstance.Five9_List_Id__c = NULL;
               leadInstance.Is_Archived__c = True;
               leadInstance.Archived_Date__c = Date.Today();
            }
            leadUpdatedList.add(leadInstance);
        }
        
        for (Database.SaveResult saveResult : Database.update(leadUpdatedList, false)) {
            if (!saveResult.isSuccess()) {
                String errorMessage;
                for (Database.Error err : saveResult.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                this.hasError = true;
                ApplicationLogger.logDMLException('Updating Lead with Five9List Id is failed', saveResult.getId(), errorMessage, true);
            }
        }
        ApplicationLogger.insertStoredLogs();
    }
    // Final method to update the campaign status based on the batch execution result.
    public void finish(Database.BatchableContext bc) {

        if (this.campaignIdVar != NULL) {
            Campaign cmpInstance = new Campaign();
            cmpInstance.Id = this.campaignIdVar;
            cmpInstance.Status = this.hasError ? 'In Progress' : (this.isActivatedVar ? 'Active' : 'Inactive');
            
            Database.SaveResult saveResult = Database.update(cmpInstance, false);
            if (!saveResult.isSuccess()) {
                String errorMessage;
                for (Database.Error err : saveResult.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                ApplicationLogger.logDMLException('Updating campaign status got failed', saveResult.getId(), errorMessage);
            }
        }
    }
}