@isTest
public with sharing class AccountTeamMemberTrigger_Test {
    
    @isTest
    static void accountTeamMemUpdate() {
        Account acct = new Account();
        acct.Name = 'Test Account';
        insert acct;
        AccountTeamMember acctTeamMem = new AccountTeamMember();
        acctTeamMem.AccountId = acct.Id;
        acctTeamMem.UserId = UserInfo.getUserId();
        insert acctTeamMem;
        Test.startTest();
        acctTeamMem.Primary_Team_Member__c = true;
        acctTeamMem.TeamMemberRole = 'Client Service Rep';
        update acctTeamMem;
        Test.stopTest();
    }
}