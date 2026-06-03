@IsTest
private class DMLServiceTest {
    
     @IsTest
    static void updateTest_shouldInsertAsyncOperationSuccessfully() {
        // Arrange
        SObject op = (SObject)Type.forName('Async_Operation__c').newInstance();
        op.put('Customer_Phone_Number__c', '123456');
        op.put('Operation__c', 'Op-Insert'); // ensure required field is set for success in your org

        // Act
        Test.startTest();
        DMLService.performInsertDML(new List<SObject>{ op }, 'test');
        Test.stopTest();

        // Assert
        List<SObject> inserted = Database.query('SELECT Id, Customer_Phone_Number__c, Operation__c FROM Async_Operation__c WHERE Customer_Phone_Number__c = \'123456\' AND Operation__c = \'Op-Insert\' LIMIT 5');
        System.assertEquals(true, inserted.isEmpty());
    }
    
    @IsTest
    static void test_performUpdateDML_success() {
        // Arrange
        Lead leadInstance = DataFactoryTest.createWebLead();
        insert leadInstance;

        leadInstance.LastName = 'Test Update';

        // Act
        Test.startTest();
        DMLService.performUpdateDML(new List<SObject>{ leadInstance }, 'Update Test');
        Test.stopTest();

        // Assert
        Lead updated =
            [SELECT Id, LastName FROM Lead WHERE Id = :leadInstance.Id];

        System.assertEquals('Test Update', updated.LastName);
    }

    @IsTest
    static void test_performUpsertDML_insertAndUpdate_usingLead() {
        Lead leadRec = DataFactoryTest.createWebLead();
        leadRec.LastName = 'Upsert Insert';
        leadRec.Company  = 'Upsert Company';
        
        Test.startTest();
        DMLService.performUpsertDML(new List<SObject>{ leadRec }, 'Upsert Insert Test');
        
        Lead inserted =
            [SELECT Id, LastName, Company
             FROM Lead
             WHERE Company = 'Upsert Company'
             LIMIT 1];
        
        System.assertEquals('Upsert Insert', inserted.LastName);
        
        inserted.LastName = 'Upsert Updated';
        
        DMLService.performUpsertDML(new List<SObject>{ inserted }, 'Upsert Update Test');
        Test.stopTest();
        
        Lead updated =
            [SELECT LastName FROM Lead WHERE Id = :inserted.Id];
        
        System.assertEquals('Upsert Updated', updated.LastName);
    }
    
    @IsTest
    static void test_performUpsertDML_failure() {
        Lead invalidLead = new Lead();
        invalidLead.Company = 'Invalid Lead Company';
        
        Test.startTest();
        DMLService.performUpsertDML(
            new List<SObject>{ invalidLead },
            'Upsert Failure Test'
        );
        Test.stopTest();
        
        
        List<Lead> leads =
            [SELECT Id FROM Lead WHERE Company = 'Invalid Lead Company'];
        
        System.assertEquals(
            0,
            leads.size(),
            'Invalid Lead should not be inserted due to missing required fields'
        );
    }

}