@IsTest
public class ContentDocumentTriggerHandlerTest {

 
    private static Opportunity createOpportunity(String name) {
        Opportunity opp = new Opportunity(
            Name        = name,
            StageName   = 'Prospecting',
            CloseDate   = Date.today().addDays(30)
        );
        insert opp;
        return opp;
    }

    private static ContentVersion createContentVersion(String title, String body) {
        ContentVersion cv = new ContentVersion(
            Title           = title,
            PathOnClient    = title + '.snote',
            VersionData     = Blob.valueOf(body),
            IsMajorVersion  = true
        );
        insert cv;
        return cv;
    }

    private static ContentDocument getContentDocument(Id contentVersionId) {
        return [
            SELECT Id, LatestPublishedVersionId, PublishStatus
            FROM ContentDocument
            WHERE Id IN (
                SELECT ContentDocumentId
                FROM ContentVersion
                WHERE Id = :contentVersionId
            )
            LIMIT 1
        ];
    }

    private static ContentDocumentLink linkDocumentToOpp(Id contentDocumentId, Id linkedEntityId) {
        ContentDocumentLink cdl = new ContentDocumentLink(
            ContentDocumentId = contentDocumentId,
            LinkedEntityId    = linkedEntityId,
            ShareType         = 'V'
        );
        insert cdl;
        return cdl;
    }

    @IsTest
    static void testAfterInsert_linksNoteToOpportunity() {
        Opportunity opp = createOpportunity('Test Opp - Link Insert');
        ContentVersion cv = createContentVersion('Closer Note', '<p>Some note content</p>');
        ContentDocument cd = getContentDocument(cv.Id);

        Test.startTest();
        linkDocumentToOpp(cd.Id, opp.Id);
        Test.stopTest();

        Opportunity result = [
            SELECT Has_Closer_Notes__c, Latest_Closer_Notes__c
            FROM Opportunity
            WHERE Id = :opp.Id
        ];

        System.assertEquals(true, result.Has_Closer_Notes__c,
            'Has_Closer_Notes__c should be true after linking a note');
        System.assert(result.Latest_Closer_Notes__c != null,
            'Latest_Closer_Notes__c should be populated');
    }

    @IsTest
    static void testAfterInsert_skipsWhenFlagAlreadySet() {
        Opportunity opp = createOpportunity('Test Opp - Flag Skip');
        ContentVersion cv = createContentVersion('Skip Note', 'Should be skipped');
        ContentDocument cd = getContentDocument(cv.Id);

        // Pre-set the static flag to simulate already-processed state
        ContentDocumentLinkHandler.notesPopulatedInOpp = true;

        Test.startTest();
        linkDocumentToOpp(cd.Id, opp.Id);
        Test.stopTest();

        Opportunity result = [
            SELECT Has_Closer_Notes__c
            FROM Opportunity
            WHERE Id = :opp.Id
        ];

        System.assertNotEquals(true, result.Has_Closer_Notes__c,
            'Should not update opp when notesPopulatedInOpp flag is already true');
    }

    @IsTest
    static void testAfterInsert_nonOppLinkedEntity_isIgnored() {
        // Link to an Account (non-Opportunity) — should not throw or update anything
        Account acc = new Account(Name = 'Test Account');
        insert acc;

        ContentVersion cv = createContentVersion('Account Note', 'Irrelevant note');
        ContentDocument cd = getContentDocument(cv.Id);

        Test.startTest();
        ContentDocumentLink cdl = new ContentDocumentLink(
            ContentDocumentId = cd.Id,
            LinkedEntityId    = acc.Id,
            ShareType         = 'V'
        );
        insert cdl;
        Test.stopTest();

        // No assertion needed — just verifying no exception is thrown
        System.assert(true, 'Non-Opportunity links should be silently ignored');
    }

    @IsTest
    static void testPopulateCloserNotes_emptyInputs_noOp() {
        Test.startTest();
        // Both null and empty sets should return without error
        ContentDocumentLinkHandler.populateCloserNotes(null, new Map<Id, Id>());
        ContentDocumentLinkHandler.populateCloserNotes(new Set<Id>(), new Map<Id, Id>());
        Test.stopTest();

        System.assert(true, 'Empty/null inputs should not throw exceptions');
    }

    // ─────────────────────────────────────────────
    // ContentDocumentTriggerHandler Tests
    // ─────────────────────────────────────────────

    @IsTest
    static void testProcessByDocumentIds_updatesOppFromPublishedDoc() {
        Opportunity opp = createOpportunity('Test Opp - Doc Update');
        ContentVersion cv = createContentVersion('Published Note', '<b>Closer content</b>');
        ContentDocument cd = getContentDocument(cv.Id);

        linkDocumentToOpp(cd.Id, opp.Id);

        // Reset flag so processByDocumentIds is not short-circuited
        ContentDocumentLinkHandler.notesPopulatedInOpp = false;

        Test.startTest();
        ContentDocumentTriggerHandler.processByDocumentIds(new Set<Id>{ cd.Id });
        Test.stopTest();

        Opportunity result = [
            SELECT Has_Closer_Notes__c, Latest_Closer_Notes__c
            FROM Opportunity
            WHERE Id = :opp.Id
        ];

        System.assertEquals(true, result.Has_Closer_Notes__c,
            'Has_Closer_Notes__c should be true after processing document');
        System.assert(result.Latest_Closer_Notes__c != null,
            'Latest_Closer_Notes__c should be populated from VersionData');
    }

        @IsTest
    static void testProcessByDocumentIds_skipsWhenFlagSet() {
    
        // Step 1 — Create Opp
        Opportunity opp = new Opportunity(
            Name = 'Test Opp - Flag Guard',
            StageName = 'Prospecting',
            CloseDate = Date.today().addDays(30),
            Has_Closer_Notes__c = false
        );
        insert opp;
    
        // Step 2 — Create Note and link it to Opp (this fires CDL trigger — that's fine)
        ContentVersion cv = new ContentVersion(
            Title        = 'Test Note',
            PathOnClient = 'TestNote.snote',
            VersionData  = Blob.valueOf('<p>Some note content</p>'),
            IsMajorVersion = true
        );
        insert cv;
    
        Id contentDocumentId = [
            SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id
        ].ContentDocumentId;
    
        ContentDocumentLink cdl = new ContentDocumentLink(
            ContentDocumentId = contentDocumentId,
            LinkedEntityId    = opp.Id,
            ShareType         = 'V'
        );
        insert cdl; // CDL trigger may fire here and update the Opp — we reset below
    
        // Step 3 — Reset the Opp fields back to false/null to establish a clean baseline
        update new Opportunity(
            Id = opp.Id,
            Has_Closer_Notes__c    = false,
            Latest_Closer_Notes__c = null
        );
    
        // Step 4 — Set the guard flag to true BEFORE calling the method
        ContentDocumentLinkHandler.notesPopulatedInOpp = true;
    
        // Step 5 — Call the method
        Test.startTest();
        ContentDocumentTriggerHandler.processByDocumentIds(
            new Set<Id>{ contentDocumentId }
        );
        Test.stopTest();
    
        // Step 6 — Assert Opp was NOT updated
        Opportunity result = [
            SELECT Has_Closer_Notes__c, Latest_Closer_Notes__c
            FROM Opportunity
            WHERE Id = :opp.Id
        ];
    
        System.assertEquals(
            false,
            result.Has_Closer_Notes__c,
            'Has_Closer_Notes__c should remain false when flag is true'
        );
        System.assertEquals(
            null,
            result.Latest_Closer_Notes__c,
            'Latest_Closer_Notes__c should remain null when flag is true'
        );
    
        // Step 7 — Cleanup static flag so it doesn't bleed into other tests
        ContentDocumentLinkHandler.notesPopulatedInOpp = false;
    }
    @IsTest
    static void testProcessByDocumentIds_nullAndEmpty_noOp() {
        Test.startTest();
        ContentDocumentTriggerHandler.processByDocumentIds(null);
        ContentDocumentTriggerHandler.processByDocumentIds(new Set<Id>());
        Test.stopTest();

        System.assert(true, 'Null/empty docIds should return silently without error');
    }

    @IsTest
    static void testProcessByDocumentIds_docNotLinkedToOpp_noUpdate() {
        // Document linked to an Account — should not update any Opportunity
        Account acc = new Account(Name = 'Unrelated Account');
        insert acc;

        ContentVersion cv = createContentVersion('Unlinked Note', 'No opp here');
        ContentDocument cd = getContentDocument(cv.Id);

        ContentDocumentLink cdl = new ContentDocumentLink(
            ContentDocumentId = cd.Id,
            LinkedEntityId    = acc.Id,
            ShareType         = 'V'
        );
        insert cdl;

        ContentDocumentLinkHandler.notesPopulatedInOpp = false;

        Test.startTest();
        ContentDocumentTriggerHandler.processByDocumentIds(new Set<Id>{ cd.Id });
        Test.stopTest();

        List<Opportunity> opps = [
            SELECT Id FROM Opportunity WHERE Has_Closer_Notes__c = true
        ];
        System.assertEquals(0, opps.size(),
            'No Opportunity should be updated when document is not linked to one');
    }
}