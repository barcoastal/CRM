@IsTest
private class LookupServiceTest {
	
    @IsTest
    static void fetchLookUpValuesTest() {
        Account acct = DataFactoryTest.createAccount();
        insert acct;

        LookupService lookup = new LookupService();
        String searchString = '{"searchTerm":"test","objectName":"Account","fields":["Name"],"labelApiName":"Name","valueApiName":"Id"}';

        Test.startTest();
        List<LookupSearchResult> result = LookupService.fetchLookUpValues(searchString, '');
        Test.stopTest();

        System.assertEquals('[{"title":"Test Account","subtitle":"","sObjectType":"Account","id":"'+acct.Id+'","icon":null}]', JSON.serialize(result));
    }

    @IsTest
    static void getRecordsTest() {
        Account acct = DataFactoryTest.createAccount();
        insert acct;

        LookupService lookup = new LookupService();
        String searchString = '{"searchTerm":"test","objectName":"Account","fields":["Name"],"labelApiName":"Name","valueApiName":"Id"}';

        Test.startTest();
        List<Id> fixedSearchResults = new List<Id>{acct.Id};
        Test.setFixedSearchResults(fixedSearchResults);
        List<LookupSearchResult> result = LookupService.getRecords(searchString);
        Test.stopTest();
		
        System.assertEquals('[{"title":"Test Account","subtitle":"","sObjectType":"Account","id":"'+acct.Id+'","icon":null}]', JSON.serialize(result));
    }
}