@IsTest
public class CaseDataTest {
    @TestSetup
    static void makeData(){
        Account acct = DataFactoryTest.createAccount();
        insert acct;
        
        Id recordTypeId = CaseUtil.getRecordTypeId(CaseUtil.RT_CUSTOMER_SERVICE);
        
        List<Case> csList = New List<Case>();
        Case cs = DataFactoryTest.createCase();
        cs.AccountId = acct.Id;
        cs.RecordTypeId = recordTypeId;
        cs.Subject = 'Test Subject';
        cs.Description = 'Test Desc';
        cs.Status = 'New';
        csList.add(cs);
        
        Case cs1 = DataFactoryTest.createCase();
        cs1.AccountId = acct.Id;
        cs1.RecordTypeId = recordTypeId;
        cs1.Subject = 'Test Subject For Case1';
        cs1.Description = 'Test Desc For Case 1';
        cs1.Status = 'New';
        csList.add(cs1);
        
        insert csList;
        
    }
    
    @isTest
    static void testgetCasesForAccount(){
        set<Id> accIdSet = New Set<Id>();
        List<Case> cs = [Select id,AccountId from case];
        for(Case c : cs){
            if(c.AccountId != null){
                accIdSet.add(c.AccountId);
            }
        }
         List<Case> queriedCases = New List<Case>();
        if(!accIdSet.isEmpty()){
            Test.startTest();
            queriedCases = CaseData.getCasesForAccount(accIdSet);
            Test.stopTest();
        }
        Assert.isNotNull(queriedCases, 'Verify the cases record retrieved');
    }
}