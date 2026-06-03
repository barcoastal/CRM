/*
    Class Name: TaskServicesAsync
    Description: This class handles the Async services that needs to be executed on Tasks (TaskHandler)
    Created By: Aditya T.
    **********************************************************************************************************************************
        Date			Modified By				Description     
    **********************************************************************************************************************************
        02/19/2024		Aditya T.				Initial Development
    **********************************************************************************************************************************
*/
public without sharing class TaskServicesAsync {
    
    /**
     * @description: Asynchronous operations on Task after insert.
     */
    @future
    public static void asyncOperationsOnAfterInsert(List<Id> taskIds) {
        OpportunityTriggerHandler.preventOpportunityLock = true;
        // Query tasks based on IDs passed as parameters
        List<Task> newTasks = [SELECT Id, whoId, whatId, Subject, Disposition__c, Five9_Agent__c, LastModifiedDate FROM Task WHERE Id IN :taskIds];
        
        TaskServices.updateLastContactedDateTime(newTasks);
        TaskServices.populateLeadFieldsForCallTransfer(newTasks);
        
    }
    
    

}