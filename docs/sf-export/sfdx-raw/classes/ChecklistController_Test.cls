@isTest
public with sharing class ChecklistController_Test {

    @isTest
    static void getChecklistItems() {
        Account acct = new Account();
        acct.Name = 'Test Account';
        insert acct;
        Checklist__c checklist = new Checklist__c();
        checklist.Name = 'Test Checklist';
        checklist.Account__c = acct.Id;
        checklist.Active__c = true;
        insert checklist;
        Task cheklistItem = new Task();
        cheklistItem.Subject = 'Test Checklist Item';
        cheklistItem.WhatId = acct.Id;
        cheklistItem.Checklist__c = checklist.Id;
        insert cheklistItem;
        Test.startTest();
        ChecklistController.getChecklistItems(acct.Id);
        Test.stopTest();
    }

    @isTest
    static void upsertchecklistItems() {
        List<ChecklistController.ChecklistItemWrapper> wrapperList = new List<ChecklistController.ChecklistItemWrapper>();
        ChecklistController.ChecklistItemWrapper wrapper = new ChecklistController.ChecklistItemWrapper();
        wrapper.subject = 'Test Subject';
        wrapperList.add(wrapper);
        Test.startTest();
        ChecklistController.upsertchecklistItems(JSON.serialize(wrapperList));
        Test.stopTest();
    }
}