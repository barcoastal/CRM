@isTest
private class TEST_SObject2Apex {
    
    /**
     * Test the constructor with an Account record
     * Verifies that recordTemplate is generated correctly
     */
    @isTest
    static void testConstructorWithAccount() {
        // Setup: Create a test Account
        Account testAccount = new Account(
            Name = 'Test Account',
            Phone = '1234567890',
            Website = 'https://www.example.com',
            AnnualRevenue = 50000
        );
        insert testAccount;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        Test.stopTest();
        
        // Verify
        String template = converter.getRecordTemplate();
        System.assertNotEquals(null, template, 'Record template should not be null');
        System.assert(template.contains('Account'), 'Template should contain Account object name');
        System.assert(template.contains('new Account'), 'Template should contain new Account constructor');
        System.assert(template.contains('Name='), 'Template should contain Name field');
    }
    
    /**
     * Test the constructor with an Opportunity record
     */
    @isTest
    static void testConstructorWithOpportunity() {
        // Setup: Create test Account and Opportunity
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        Opportunity testOpp = new Opportunity(
            Name = 'Test Opportunity',
            AccountId = testAccount.Id,
            StageName = 'Prospecting',
            CloseDate = Date.today(),
            Amount = 10000
        );
        insert testOpp;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testOpp.Id);
        Test.stopTest();
        
        // Verify
        String template = converter.getRecordTemplate();
        System.assertNotEquals(null, template, 'Record template should not be null');
        System.assert(template.contains('Opportunity'), 'Template should contain Opportunity object name');
        System.assert(template.contains('new Opportunity'), 'Template should contain new Opportunity constructor');
    }
    
    /**
     * Test formatField with Date values
     */
    @isTest
    static void testFormatFieldWithDate() {
        // Setup: Create a test Account
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        
        // Test the formatField method via reflection
        Date testDate = Date.newInstance(2026, 1, 27);
        String formattedDate = converter.formatField(testDate);
        Test.stopTest();
        
        // Verify
        System.assertNotEquals(null, formattedDate, 'Formatted date should not be null');
        System.assert(formattedDate.contains('Date.newInstance'), 'Should use Date.newInstance format');
        System.assert(formattedDate.contains('2026'), 'Should contain year');
        System.assert(formattedDate.contains('1'), 'Should contain month');
        System.assert(formattedDate.contains('27'), 'Should contain day');
    }
    
    /**
     * Test formatField with DateTime values
     */
    @isTest
    static void testFormatFieldWithDateTime() {
        // Setup: Create a test Account
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        
        DateTime testDateTime = DateTime.newInstance(2026, 1, 27, 14, 30, 45);
        String formattedDateTime = converter.formatField(testDateTime);
        Test.stopTest();
        
        // Verify
        System.assertNotEquals(null, formattedDateTime, 'Formatted datetime should not be null');
        System.assert(formattedDateTime.contains('DateTime.newInstance'), 'Should use DateTime.newInstance format');
        System.assert(formattedDateTime.contains('2026'), 'Should contain year');
        System.assert(formattedDateTime.contains('14'), 'Should contain hour');
        System.assert(formattedDateTime.contains('30'), 'Should contain minute');
    }
    
    /**
     * Test formatField with null value
     */
    @isTest
    static void testFormatFieldWithNull() {
        // Setup: Create a test Account
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        String formattedNull = converter.formatField(null);
        Test.stopTest();
        
        // Verify
        System.assertEquals(null, formattedNull, 'Formatted null should return null');
    }
    
    /**
     * Test formatField with Integer value
     */
    @isTest
    static void testFormatFieldWithInteger() {
        // Setup: Create a test Account
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        String formattedInteger = converter.formatField(12345);
        Test.stopTest();
        
        // Verify
        System.assertNotEquals(null, formattedInteger, 'Formatted integer should not be null');
        System.assertEquals('12345', formattedInteger, 'Should return string representation of integer');
        System.assert(!formattedInteger.contains('\''), 'Integer should not have quotes');
    }
    
    /**
     * Test formatField with Decimal value
     */
    @isTest
    static void testFormatFieldWithDecimal() {
        // Setup: Create a test Account
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        Decimal testDecimal = 123.45;
        String formattedDecimal = converter.formatField(testDecimal);
        Test.stopTest();
        
        // Verify
        System.assertNotEquals(null, formattedDecimal, 'Formatted decimal should not be null');
        System.assertEquals('123.45', formattedDecimal, 'Should return string representation of decimal');
        System.assert(!formattedDecimal.contains('\''), 'Decimal should not have quotes');
    }
    
    /**
     * Test formatField with String value
     */
    @isTest
    static void testFormatFieldWithString() {
        // Setup: Create a test Account
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        String formattedString = converter.formatField('Test String Value');
        Test.stopTest();
        
        // Verify
        System.assertNotEquals(null, formattedString, 'Formatted string should not be null');
        System.assertEquals('\'Test String Value\'', formattedString, 'String should be wrapped in single quotes');
    }
    
    /**
     * Test formatField with Boolean value
     */
    @isTest
    static void testFormatFieldWithBoolean() {
        // Setup: Create a test Account
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        String formattedBoolean = converter.formatField(true);
        Test.stopTest();
        
        // Verify
        System.assertNotEquals(null, formattedBoolean, 'Formatted boolean should not be null');
        System.assertEquals('\'true\'', formattedBoolean, 'Boolean should be wrapped in quotes');
    }
    
    /**
     * Test buildQuery static method
     */
    @isTest
    static void testBuildQuery() {
        // Execute
        Test.startTest();
        String query = SObject2Apex.buildQuery(Account.SObjectType);
        Test.stopTest();
        
        // Verify
        System.assertNotEquals(null, query, 'Query should not be null');
        System.assert(query.startsWith('SELECT '), 'Query should start with SELECT');
        System.assert(query.contains('FROM Account'), 'Query should contain FROM Account');
        System.assert(query.contains(','), 'Query should contain multiple fields');
        System.assert(query.contains('FROM'), 'Query should have FROM clause');
    }
    
    /**
     * Test buildQuery with different SObject types
     */
    @isTest
    static void testBuildQueryWithOpportunity() {
        // Execute
        Test.startTest();
        String query = SObject2Apex.buildQuery(Opportunity.SObjectType);
        Test.stopTest();
        
        // Verify
        System.assertNotEquals(null, query, 'Query should not be null');
        System.assert(query.contains('FROM Opportunity'), 'Query should contain FROM Opportunity');
    }
    
    /**
     * Test getRecordTemplate method
     */
    @isTest
    static void testGetRecordTemplate() {
        // Setup: Create a test Account with various field types
        Account testAccount = new Account(
            Name = 'Complete Test Account',
            Phone = '5551234567',
            Website = 'https://example.org'
        );
        insert testAccount;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        String template = converter.getRecordTemplate();
        Test.stopTest();
        
        // Verify
        System.assertNotEquals(null, template, 'Template should not be null');
        System.assert(template.contains('new Account('), 'Template should have constructor');
        System.assert(template.endsWith(');'), 'Template should end with semicolon');
        System.assert(template.contains('Name='), 'Template should include Name field with value');
    }
    
    /**
     * Test with empty/minimal Account
     */
    @isTest
    static void testWithMinimalAccount() {
        // Setup: Create minimal Account with only required field
        Account testAccount = new Account(Name = 'Minimal Account');
        insert testAccount;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        String template = converter.getRecordTemplate();
        Test.stopTest();
        
        // Verify
        System.assertNotEquals(null, template, 'Template should not be null even with minimal data');
        System.assert(template.contains('new Account('), 'Should generate valid constructor');
    }
    
    /**
     * Test query execution in buildQuery
     */
    @isTest
    static void testBuildQueryExecutesSuccessfully() {
        // Setup: Create test Account
        Account testAccount = new Account(Name = 'Query Test Account');
        insert testAccount;
        
        // Execute
        Test.startTest();
        String query = SObject2Apex.buildQuery(Account.SObjectType);
        String whereClause = ' WHERE Id = \'' + testAccount.Id + '\'';
        List<SObject> results = Database.query(query + whereClause);
        Test.stopTest();
        
        // Verify
        System.assertEquals(1, results.size(), 'Query should return the test account');
        System.assertEquals(testAccount.Id, results[0].Id, 'Returned record should match inserted account');
    }

    /**
     * Test getChildRecordsTemplate with Opportunities
     * Verifies that child record templates are generated correctly with list.add() format
     */
    @isTest
    static void testGetChildRecordsTemplateWithOpportunities() {
        // Setup: Create test Account and multiple Opportunities
        Account testAccount = new Account(Name = 'Parent Account');
        insert testAccount;
        
        List<Opportunity> testOpps = new List<Opportunity>();
        testOpps.add(new Opportunity(
            Name = 'Opportunity 1',
            AccountId = testAccount.Id,
            StageName = 'Prospecting',
            CloseDate = Date.today(),
            Amount = 10000
        ));
        testOpps.add(new Opportunity(
            Name = 'Opportunity 2',
            AccountId = testAccount.Id,
            StageName = 'Negotiation/Review',
            CloseDate = Date.today().addDays(30),
            Amount = 25000
        ));
        insert testOpps;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        List<String> childTemplates = converter.getChildRecordsTemplate(testAccount.Id, 'Opportunity');
        Test.stopTest();
        
        // Verify
        System.assertEquals(2, childTemplates.size(), 'Should return 2 opportunity templates');
        for (String template : childTemplates) {
            System.assert(template.contains('.add(new Opportunity('), 'Template should use list.add() format');
            System.assert(template.contains('Name='), 'Template should contain Name field');
            System.assert(template.contains('Amount='), 'Template should contain Amount field');
            System.assert(template.endsWith('));'), 'Template should end with ));');
        }
    }

    /**
     * Test getChildRecordsTemplate with no child records
     */
    @isTest
    static void testGetChildRecordsTemplateWithNoChildren() {
        // Setup: Create test Account with no opportunities
        Account testAccount = new Account(Name = 'Account With No Opps');
        insert testAccount;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        List<String> childTemplates = converter.getChildRecordsTemplate(testAccount.Id, 'Opportunity');
        Test.stopTest();
        
        // Verify
        System.assertEquals(0, childTemplates.size(), 'Should return empty list when no children exist');
    }

    /**
     * Test getChildRecordsTemplate with invalid SObject type
     */
    @isTest
    static void testGetChildRecordsTemplateWithInvalidSObjectType() {
        // Setup: Create test Account
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        List<String> childTemplates = converter.getChildRecordsTemplate(testAccount.Id, 'InvalidSObjectType');
        Test.stopTest();
        
        // Verify
        System.assertEquals(0, childTemplates.size(), 'Should return empty list for invalid SObject type');
    }

    /**
     * Test findRelationshipField method
     */
    @isTest
    static void testFindRelationshipField() {
        // Setup: Create test Account and Opportunity
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        Opportunity testOpp = new Opportunity(
            Name = 'Test Opportunity',
            AccountId = testAccount.Id,
            StageName = 'Prospecting',
            CloseDate = Date.today(),
            Amount = 10000
        );
        insert testOpp;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        String relationshipField = converter.findRelationshipField(Opportunity.SObjectType, Account.SObjectType);
        Test.stopTest();
        
        // Verify
        System.assertNotEquals(null, relationshipField, 'Should find relationship field');
        System.assertEquals('accountid', relationshipField, 'Should return accountid as the relationship field (lowercase API name)');
    }

    /**
     * Test findRelationshipField with non-existent relationship
     */
    @isTest
    static void testFindRelationshipFieldWithInvalidRelationship() {
        // Setup: Create test Account
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        // Contact has no direct relationship to Opportunity (reverse of normal direction)
        String relationshipField = converter.findRelationshipField(Contact.SObjectType, Opportunity.SObjectType);
        Test.stopTest();
        
        // Verify
        System.assertEquals(null, relationshipField, 'Should return null when no relationship exists');
    }

    /**
     * Test generateRecordTemplate method
     */
    @isTest
    static void testGenerateRecordTemplate() {
        // Setup: Create test Opportunity
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        Opportunity testOpp = new Opportunity(
            Name = 'Generated Template Opp',
            AccountId = testAccount.Id,
            StageName = 'Prospecting',
            CloseDate = Date.today(),
            Amount = 50000
        );
        insert testOpp;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        String template = converter.generateRecordTemplate(testOpp, Opportunity.SObjectType);
        Test.stopTest();
        
        // Verify
        System.assertNotEquals(null, template, 'Template should not be null');
        System.assert(template.contains('new Opportunity('), 'Template should contain Opportunity constructor');
        System.assert(template.contains('Name=\'Generated Template Opp\''), 'Template should contain Name field with value');
        System.assert(template.contains('Amount=50000'), 'Template should contain Amount field');
        System.assert(template.endsWith(');'), 'Template should end with semicolon');
    }

    /**
     * Test that child templates match the same format as parent templates
     */
    @isTest
    static void testChildTemplateFormatConsistency() {
        // Setup: Create test Account and Opportunity
        Account testAccount = new Account(
            Name = 'Format Test Account',
            Phone = '5551234567'
        );
        insert testAccount;
        
        Opportunity testOpp = new Opportunity(
            Name = 'Format Test Opp',
            AccountId = testAccount.Id,
            StageName = 'Prospecting',
            CloseDate = Date.today(),
            Amount = 15000
        );
        insert testOpp;
        
        // Execute
        Test.startTest();
        SObject2Apex accountConverter = new SObject2Apex(testAccount.Id);
        String parentTemplate = accountConverter.getRecordTemplate();
        
        SObject2Apex oppConverter = new SObject2Apex(testOpp.Id);
        String oppTemplate = oppConverter.getRecordTemplate();
        
        List<String> childTemplates = accountConverter.getChildRecordsTemplate(testAccount.Id, 'Opportunity');
        Test.stopTest();
        
        // Verify both parent and child use same format pattern
        System.assert(parentTemplate.contains('new Account('), 'Parent should use new SObjectType( format');
        System.assert(oppTemplate.contains('new Opportunity('), 'Opp should use new SObjectType( format');
        System.assert(childTemplates[0].contains('.add(new Opportunity('), 'Child should use list.add(new SObjectType( format');
        System.assert(childTemplates[0].endsWith('));'), 'Child should end with ));');
    }

    /**
     * Test generateChildTemplate method
     */
    @isTest
    static void testGenerateChildTemplate() {
        // Setup: Create test Account and Opportunity
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        Opportunity testOpp = new Opportunity(
            Name = 'Child Template Test Opp',
            AccountId = testAccount.Id,
            StageName = 'Prospecting',
            CloseDate = Date.today(),
            Amount = 50000
        );
        insert testOpp;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        String childTemplate = converter.generateChildTemplate(testOpp, Opportunity.SObjectType, 'Account', 'opps');
        Test.stopTest();
        
        // Verify
        System.assertNotEquals(null, childTemplate, 'Child template should not be null');
        System.assert(childTemplate.contains('opps.add(new Opportunity('), 'Template should use list.add() format');
        System.assert(childTemplate.contains('Name=\'Child Template Test Opp\''), 'Template should contain Name field with value');
        System.assert(childTemplate.contains('Amount=50000'), 'Template should contain Amount field');
        System.assert(childTemplate.endsWith('));'), 'Template should end with ));');
        System.assert(childTemplate.contains('thisAccount.Id'), 'Template should contain parent ID reference');
    }

    /**
     * Test generateListVariable method
     */
    @isTest
    static void testGenerateListVariable() {
        // Setup: Create a test Account
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Execute
        Test.startTest();
        SObject2Apex converter = new SObject2Apex(testAccount.Id);
        
        String varName1 = converter.generateListVariable('Five9 Call Log');
        String varName2 = converter.generateListVariable('Opportunity');
        String varName3 = converter.generateListVariable('Contact');
        Test.stopTest();
        
        // Verify
        System.assertEquals('five9CallLogs', varName1, 'Should convert multi-word label to camelCase plural (first word lowercase)');
        System.assertEquals('opportunitys', varName2, 'Should convert single-word label to plural');
        System.assertEquals('contacts', varName3, 'Should convert single-word label to plural');
    }
}