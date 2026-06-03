/*----------------------------------------------------------------
    Author: Vinitha 
    Description: A batch class to set first draft date and first contract signed date on account
    Test Class: 

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Oct-28-2024      Vinitha                      Initial Development                
--------------------------------------------------------------------*/
public without sharing class Batch_UpdateFieldsOnAccount implements Database.Batchable<SObject> {    
    
    public Database.QueryLocator start(Database.BatchableContext bc){
        String query = 'SELECT Id, AccountId, CreatedDate FROM Opportunity WHERE AccountId != null AND First_Draft_Date__c = null ORDER BY CreatedDate ASC';
        return Database.getQueryLocator(query);
    } 
    
    // Execute method to update redial time and delete from f9list id on Lead.
    public void execute(Database.BatchableContext BC, List<Opportunity> scope){
        Map<Id, Id> programMap = new Map<Id, Id>();
        Set<Id> AccountIds = new Set<Id>();
        List<Account> updateAccts = new List<Account>();
        for(Opportunity opp: scope){
            AccountIds.add(opp.AccountId);
        }
        system.debug(':::AccountIds::'+AccountIds);
        for(Program_Plan__c proPlan: [SELECT Id, Client__c, Opportunity__c FROM Program_Plan__c WHERE Client__c IN:AccountIds AND Opportunity__c != null]){
            programMap.put(proPlan.Id, proPlan.Client__c); 
        }
        Map<Id, AggregateResult> draftMap = DraftData.getStartEndDraftDatesByStaus(programMap.keySet(), DraftUtil.firstDraftDateStatus);
        system.debug(':::draftMap:::'+draftMap);
        for (Program_Plan__c proPlan: [SELECT Id, Client__c, Opportunity__c FROM Program_Plan__c WHERE Id IN:programMap.keySet()]) { 
            if(draftMap.containsKey(proPlan.Id)){
                Account acc = new Account(
                    Id = proPlan.Client__c, 
                    First_Draft_Date__c = Date.valueOf(draftMap.get(proPlan.Id).get('startDate'))
                );
                updateAccts.add(acc);
            }            
        }
        if(!updateAccts.isEmpty()){
            update updateAccts;
        }  
    }
    
    public void finish(Database.BatchableContext bc) {
       
    }
}