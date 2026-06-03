@IsTest
private class LookupSearchResultTest {

    @IsTest   
    public static void testLookupSearchResult() {

        Account account = new Account(Name = 'Test Account');
        insert account;
        // Create a LookupSearchResult instance
        LookupSearchResult result = new LookupSearchResult(
            account.Id, 'Account', 'standard:account', 'Test Account', 
            'Test Account Subtitle'
        );
        
        // Verify the getter methods
        System.assertEquals(account.Id, result.getId());
        System.assertEquals('Account', result.getSObjectType());
        System.assertEquals('standard:account', result.getIcon());
        System.assertEquals('Test Account', result.getTitle());
        System.assertEquals('Test Account Subtitle', result.getSubtitle());
    }

    @IsTest
    static void testCompareTo(){

        List<LookupSearchResult> lookupSearchResults = new List<LookupSearchResult> {
            new LookupSearchResult(null, null, null, 'Test Account', 'Test Account Subtitle'),
            new LookupSearchResult(null, null, null, 'Another Account', 'Another Account Subtitle'), 
            new LookupSearchResult(null, null, null, null, null),
            new LookupSearchResult(null, null, null, null, null)
        };

        // Sort using the custom compareTo() method
        lookupSearchResults.sort();
        
        System.assertEquals('Another Account', lookupSearchResults[0].getTitle());
        System.assertEquals('Test Account', lookupSearchResults[1].getTitle());
        System.assertEquals(null, lookupSearchResults[2].getTitle());      
        System.assertEquals(null, lookupSearchResults[3].getTitle());      
    }
}