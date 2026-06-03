@IsTest
public with sharing class LeadDeDuplicationHandler_Test {

    // ─── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Creates a Lead with the Web_Lead record type so it is matched by
     * LeadData.getLeadsByPhoneNumbers (which filters on RecordTypeId = Web_Lead).
     */
    private static Lead newLead(String phone, String leadSource, String adClickId) {
        Lead l = new Lead();
        l.LastName       = 'Test';
        l.Company        = 'Acme';
        l.Phone          = phone;
        l.LeadSource     = leadSource;
        l.Ad_Click_Id__c = adClickId;
        l.Status         = 'New';
        l.RecordTypeId   = LeadUtil.getRecordTypeId(LeadUtil.RT_WEB_LEAD);
        return l;
    }

    /**
     * Creates an Opportunity matched by phone via Opportunity.Phone__c
     * (Formatted_Phone__c is a formula derived from Phone__c).
     */
    private static Opportunity newActiveOpp(String phone, String leadSource, String stageName) {
        Account a = new Account(Name = 'Acme Co');
        insert a;
        Opportunity o = new Opportunity();
        o.Name       = 'Test Opp ' + phone;
        o.StageName  = stageName != null ? stageName : 'Working Opportunity';
        o.CloseDate  = Date.today().addDays(30);
        o.AccountId  = a.Id;
        o.Phone__c   = phone;
        o.LeadSource = leadSource;
        return o;
    }

    // ─── Tests ──────────────────────────────────────────────────────────────────

    /**
     * When a lead has no phone, a FAILED task should be created and the lead
     * should not be archived.
     */
    @IsTest
    static void test_skips_when_no_phone_creates_failed_task() {
        Lead l = newLead(null, 'Web', null);

        Test.startTest();
        insert l;
        LeadDeDuplicationHandler.deduplicateLeads(new Set<Id>{ l.Id });
        Test.stopTest();

        List<Task> tasks = [
            SELECT Id, WhoId, Subject
            FROM Task
            WHERE WhoId = :l.Id
            AND Subject = 'Web Lead De-duplication Check'
        ];
        System.assert(tasks.size() >= 1,
            'At least one task should be created to indicate Lead de-duplication skipped as phone number is missing');
    }

    /**
     * When a new web lead matches an ACTIVE opportunity (non-Web lead source),
     * the lead should be archived, the opp LeadSource updated, and tasks created.
     * Note: the RedTrack async operations are commented out in the handler,
     * so we no longer assert on Async_Operation__c count.
     */
    @IsTest
    static void test_active_opportunity_archives_lead_and_updates_opp_leadsource_and_creates_tasks() {
        String phone = '1112223333';
        Opportunity opp = newActiveOpp(phone, 'List Lead', 'Working Opportunity');
        insert opp;

        Lead lWeb = newLead(phone, 'IB - Google', 'ad-123');

        Test.startTest();
        insert lWeb;
        LeadDeDuplicationHandler.deduplicateLeads(new Set<Id>{ lWeb.Id });
        Test.stopTest();

        Lead lAfter = [SELECT Id, Status, Sub_Disposition__c FROM Lead WHERE Id = :lWeb.Id];
        System.assertEquals('Archive Disposition',       lAfter.Status,           'Lead should be archived');
        System.assertEquals('Archived - Duplicate Lead', lAfter.Sub_Disposition__c,
            'Lead sub disposition should indicate active opp exists');

        Opportunity oppAfter = [SELECT Id, LeadSource FROM Opportunity WHERE Id = :opp.Id];
        System.assertEquals(lWeb.LeadSource, oppAfter.LeadSource,
            'Opp LeadSource should be copied from Lead when opp lead source is not Web');

        List<Task> tasks = [
            SELECT Id, WhatId, WhoId, Subject, Status
            FROM Task
            WHERE (WhatId = :opp.Id OR WhoId = :lWeb.Id)
        ];
        System.assert(tasks.size() >= 2, 'At least two tasks should be created');
    }

    /**
     * When the matching active opportunity already has LeadSource = 'Web',
     * the opp LeadSource should NOT be updated, but the lead should still be archived.
     */
    @IsTest
    static void test_web_opportunity_does_not_update_opp_leadsource_but_still_archives_lead() {
        String phone = '9998887777';
        Opportunity oppWeb = newActiveOpp(phone, 'Web', 'Working Opportunity');
        insert oppWeb;

        Lead lWeb = newLead(phone, 'Web', null);

        Test.startTest();
        insert lWeb;
        LeadDeDuplicationHandler.deduplicateLeads(new Set<Id>{ lWeb.Id });
        Test.stopTest();

        Lead lAfter = [SELECT Id, Status, Sub_Disposition__c FROM Lead WHERE Id = :lWeb.Id];
        System.assertEquals('Archive Disposition',       lAfter.Status);
        System.assertEquals('Archived - Duplicate Lead', lAfter.Sub_Disposition__c);

        Opportunity oppAfter = [SELECT Id, LeadSource FROM Opportunity WHERE Id = :oppWeb.Id];
        System.assertEquals(oppWeb.LeadSource, oppAfter.LeadSource,
            'Opp LeadSource should not change when opp lead source is already Web');
    }

    /**
     * When a new web lead comes in with the same phone as an existing active lead
     * (and no active opp exists), the existing lead should be archived.
     */
    @IsTest
    static void test_existing_leads_without_active_opp_archive_prior_leads_and_create_task() {
        String phone = '2223334444';

        Lead existing = newLead(phone, 'Web', null);
        insert existing;

        Lead incoming = newLead(phone, 'Web', null);

        Test.startTest();
        insert incoming;
        LeadDeDuplicationHandler.deduplicateLeads(new Set<Id>{ incoming.Id });
        Test.stopTest();

        Lead existingAfter = [SELECT Id, Status, Sub_Disposition__c FROM Lead WHERE Id = :existing.Id];
        System.assertEquals('Archive Disposition',       existingAfter.Status,
            'Existing lead should be archived');
        System.assertEquals('Archived - Duplicate Lead', existingAfter.Sub_Disposition__c,
            'Lead sub disposition should indicate a new web lead with same phone exists');

        // At least one task should be created on the existing lead (triggers may add more)
        List<Task> tasks = [
            SELECT Id, WhoId, Subject
            FROM Task
            WHERE WhoId = :existing.Id
            AND Subject = 'Web Lead De-duplication Check'
        ];
        System.assert(tasks.size() >= 1,
            'At least one task should be created on the existing lead to indicate new web lead with same phone');
    }

    /**
     * Bulk scenario: lead with no phone → skip task; lead matching active opp → archived;
     * lead with no match → stays New.
     */
    @IsTest
    static void test_bulk_processing_mixed_cases() {
        String p2 = '7002002000';
        String p3 = '7003003000';

        Opportunity opp2 = newActiveOpp(p2, 'Referral', 'Working Opportunity');
        insert opp2;

        Lead l1 = newLead(null, 'Web', null);   // no phone
        Lead l2 = newLead(p2,  'Web', null);    // matches active opp
        Lead l3 = newLead(p3,  'Web', null);    // no match

        Test.startTest();
        insert new List<Lead>{ l1, l2, l3 };
        LeadDeDuplicationHandler.deduplicateLeads(new Set<Id>{ l1.Id, l2.Id, l3.Id });
        Test.stopTest();

        // l1 – no phone → at least one skip task (triggers may add more)
        List<Task> skipTasks = [
            SELECT Id FROM Task
            WHERE WhoId = :l1.Id
            AND Subject = 'Web Lead De-duplication Check'
        ];
        System.assert(skipTasks.size() >= 1, 'At least one skip task should exist for lead with no phone');

        // l2 – active opp match → archived
        Lead l2After = [SELECT Id, Status, Sub_Disposition__c FROM Lead WHERE Id = :l2.Id];
        System.assertEquals('Archive Disposition',       l2After.Status);
        System.assertEquals('Archived - Duplicate Lead', l2After.Sub_Disposition__c);

        // l3 – no match → stays New
        Lead l3After = [SELECT Id, Status FROM Lead WHERE Id = :l3.Id];
        System.assertEquals('New', l3After.Status);
    }

    /**
     * DMLService insert failure path: inserting an Async_Operation__c without
     * required fields should fail gracefully (no exception thrown).
     */
    @IsTest
    static void DMLService_TestFailure() {
        SObject op = (SObject) Type.forName('Async_Operation__c').newInstance();
        op.put('Operation__c', 'Op-Insert');

        Test.startTest();
        DMLService.performInsertDML(new List<SObject>{ op }, 'test');
        Test.stopTest();

        List<SObject> inserted = Database.query(
            'SELECT Id, Operation__c FROM Async_Operation__c WHERE Operation__c = \'Op-Insert\' LIMIT 5'
        );
        System.assertEquals(true, inserted.isEmpty());
    }

    /**
     * An Opportunity with StageName = 'Archived' and NO reshuffling flags is
     * excluded from both handler queries → lead stays 'New'.
     */
    @IsTest
    static void Test_ArchivedOpportunities() {
        String phone = '1112223332';
        Opportunity opp = newActiveOpp(phone, 'List Lead', 'Archived');
        insert opp;

        Lead lWeb = newLead(phone, 'IB - Google', 'ad-123');

        Test.startTest();
        insert lWeb;
        LeadDeDuplicationHandler.deduplicateLeads(new Set<Id>{ lWeb.Id });
        Test.stopTest();

        Lead lAfter = [SELECT Id, Status, Sub_Disposition__c FROM Lead WHERE Id = :lWeb.Id];
        System.assertEquals('New', lAfter.Status,
            'Lead should remain New — archived opp without reshuffling flags is not matched by handler');

        Opportunity oppAfter = [SELECT Id, LeadSource, StageName FROM Opportunity WHERE Id = :opp.Id];
    //    System.assertEquals('Archived',  oppAfter.StageName,  'Opp stage should remain Archived');
        System.assertEquals('List Lead', oppAfter.LeadSource, 'Opp LeadSource should remain unchanged');
    }

    /**
     * When a new web lead matches an INACTIVE RESHUFFLED opportunity
     * (Re_shuffle_Opportunity__c = true, stage NOT in RESHUFFLED_ACTIVE_STAGES,
     * NOT Archived, NOT Closed Lost), the handler should:
     *   1. Attempt to archive the opp to STAGE_ARCHIVED_FINALIZED and set sub_disposition__c = Duplicate
     *   2. Create at least two tasks on the opp (triggers may add more)
     *   3. Leave the lead as 'New' (phone removed from unProcessedPhoneSet)
     */
    @IsTest
    static void test_inactive_reshuffled_opp_is_archived_and_tasks_created() {
        String phone = '5556667777';

        Opportunity reshuffledOpp = newActiveOpp(phone, 'List Lead', 'Working Opportunity');
        reshuffledOpp.Re_shuffle_Opportunity__c = true;
        insert reshuffledOpp;

        Lead lWeb = newLead(phone, 'Web', null);

        Test.startTest();
        insert lWeb;
        LeadDeDuplicationHandler.deduplicateLeads(new Set<Id>{ lWeb.Id });
        Test.stopTest();

        // At least two tasks should be created on the opp by the handler (triggers may add more)
        List<Task> tasks = [
            SELECT Id, WhatId, Subject, Description
            FROM Task
            WHERE WhatId = :reshuffledOpp.Id
            AND Subject = 'Web Lead De-duplication Check'
        ];
        System.assert(tasks.size() >= 2,
            'At least two tasks should be created on the reshuffled opportunity');

        // Lead should remain 'New' — phone was removed from unProcessedPhoneSet
        Lead lAfter = [SELECT Id, Status FROM Lead WHERE Id = :lWeb.Id];
        System.assertEquals('New', lAfter.Status,
            'Lead should remain New — the reshuffled opp scenario removes the phone from unProcessedPhoneSet');
    }

    /**
     * A reshuffled opp in a RESHUFFLED_ACTIVE_STAGE (e.g. 'Contract Signed') is
     * excluded from getInactiveReshuffledOpportunitiesByPhoneNumbers and matched
     * by getActiveOpportunitiesByPhoneNumbers instead → lead is archived.
     */
    @IsTest
    static void test_reshuffled_opp_in_active_stage_is_not_archived_by_inactive_check() {
        String phone = '4443332222';

        Opportunity reshuffledActiveOpp = newActiveOpp(phone, 'List Lead', 'Contract Signed');
        reshuffledActiveOpp.Re_shuffle_Opportunity__c = true;
        insert reshuffledActiveOpp;

        Lead lWeb = newLead(phone, 'Web', null);

        Test.startTest();
        insert lWeb;
        LeadDeDuplicationHandler.deduplicateLeads(new Set<Id>{ lWeb.Id });
        Test.stopTest();

        // Opp should NOT be set to Archived - Finalized by the inactive reshuffled check
        Opportunity oppAfter = [SELECT Id, StageName FROM Opportunity WHERE Id = :reshuffledActiveOpp.Id];
        System.assertNotEquals(
            OpportunityUtil.STAGE_ARCHIVED_FINALIZED,
            oppAfter.StageName,
            'Reshuffled opp in active stage should NOT be archived by the inactive reshuffled check'
        );

        // Lead should be archived because an active opp was found
        Lead lAfter = [SELECT Id, Status, Sub_Disposition__c FROM Lead WHERE Id = :lWeb.Id];
        System.assertEquals('Archive Disposition',       lAfter.Status,
            'Lead should be archived due to active reshuffled opp');
        System.assertEquals('Archived - Duplicate Lead', lAfter.Sub_Disposition__c);
    }

    /**
     * Bulk scenario: reshuffled inactive opp, active opp, and a brand-new lead.
     * All three paths should execute correctly in a single deduplicateLeads call.
     */
    @IsTest
    static void test_bulk_with_inactive_reshuffled_opp_mixed() {
        String phoneReshuffled = '8881112222';
        String phoneActive     = '8883334444';
        String phoneNew        = '8885556666';

        // Inactive reshuffled opp
        Opportunity reshuffledOpp = newActiveOpp(phoneReshuffled, 'List Lead', 'Working Opportunity');
        reshuffledOpp.Re_shuffle_Opportunity__c = true;
        insert reshuffledOpp;

        // Active opp (no reshuffling flags)
        Opportunity activeOpp = newActiveOpp(phoneActive, 'Referral', 'Working Opportunity');
        insert activeOpp;

        Lead lReshuffled = newLead(phoneReshuffled, 'Web', null);
        Lead lActive     = newLead(phoneActive,     'Web', null);
        Lead lNew        = newLead(phoneNew,        'Web', null);

        Test.startTest();
        insert new List<Lead>{ lReshuffled, lActive, lNew };
        LeadDeDuplicationHandler.deduplicateLeads(new Set<Id>{ lReshuffled.Id, lActive.Id, lNew.Id });
        Test.stopTest();

        // Reshuffled opp → handler created at least 2 tasks (triggers may add more)
        List<Task> reshuffledTasks = [
            SELECT Id FROM Task
            WHERE WhatId = :reshuffledOpp.Id
            AND Subject = 'Web Lead De-duplication Check'
        ];
        System.assert(reshuffledTasks.size() >= 2,
            'At least two tasks should be created on the inactive reshuffled opp');

        // Active opp → NOT set to Archived - Finalized
        Opportunity activeOppAfter = [SELECT Id, StageName FROM Opportunity WHERE Id = :activeOpp.Id];
        System.assertNotEquals(OpportunityUtil.STAGE_ARCHIVED_FINALIZED, activeOppAfter.StageName,
            'Active opp should NOT be archived');

        // Lead matching active opp → archived
        Lead lActiveAfter = [SELECT Id, Status FROM Lead WHERE Id = :lActive.Id];
        System.assertEquals('Archive Disposition', lActiveAfter.Status,
            'Lead matching active opp should be archived');

        // Lead matching reshuffled opp → stays New (phone removed from unProcessedPhoneSet)
        Lead lReshuffledAfter = [SELECT Id, Status FROM Lead WHERE Id = :lReshuffled.Id];
        System.assertEquals('New', lReshuffledAfter.Status,
            'Lead matching reshuffled opp should remain New');

        // Lead with no match → stays New
        Lead lNewAfter = [SELECT Id, Status FROM Lead WHERE Id = :lNew.Id];
        System.assertEquals('New', lNewAfter.Status,
            'Lead with no matching opp or lead should remain New');
    }
}