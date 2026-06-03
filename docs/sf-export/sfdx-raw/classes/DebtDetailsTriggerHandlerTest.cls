@isTest
private class DebtDetailsTriggerHandlerTest {

    // ─────────────────────────────────────────────────────────────────────
    // CONSTANTS — must match picklist API values exactly
    // ─────────────────────────────────────────────────────────────────────
    private static final String VLP     = 'Victory Legal Plan';
    private static final String CITADEL = 'Citadel';

    // ─────────────────────────────────────────────────────────────────────
    // TEST SETUP — Shared data for ALL test methods
    // ─────────────────────────────────────────────────────────────────────
    @TestSetup
    static void makeData() {

        // ── Business Account ───────────────────────────────────────────
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.Name             = 'Test Account';
        acctRecord.SSN__c           = '123456780';
        acctRecord.Phone            = '1234567890';
        acctRecord.Lead_Number__c   = '12345643';
        acctRecord.RecordTypeId     = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'Business_Account');
        insert acctRecord;

        // ── Opportunity ────────────────────────────────────────────────
        Opportunity opportunity = new Opportunity(
            Name                          = 'Test Opportunity',
            StageName                     = 'Contract Signed',
            CloseDate                     = Date.today(),
            AccountId                     = acctRecord.Id,
            External_Debit_Schedule_Id__c = '123'
        );
        insert opportunity;

        // ── Creditor Accounts (Creditor Record Type) ───────────────────
        Id creditorRTId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'Creditor');

        Account vlpCreditor1 = new Account(
            Name                 = 'VLP Creditor 1',
            RecordTypeId         = creditorRTId,
            Creditor_Category__c = VLP
        );
        Account vlpCreditor2 = new Account(
            Name                 = 'VLP Creditor 2',
            RecordTypeId         = creditorRTId,
            Creditor_Category__c = VLP
        );
        Account citadelCreditor = new Account(
            Name                 = 'Citadel Creditor',
            RecordTypeId         = creditorRTId,
            Creditor_Category__c = CITADEL
        );
        insert new List<Account>{ vlpCreditor1, vlpCreditor2, citadelCreditor };

        // ── Base Debt Detail (no creditor — for aggregation tests) ─────
        Debt_Details__c debt = new Debt_Details__c(
            Opportunity__c = opportunity.Id,
            Debt_Amount__c = 1000,
            Account__c     = acctRecord.Id
        );
        insert debt;
    }

    // ═════════════════════════════════════════════════════════════════════
    // ── EXISTING TESTS (Aggregation — Preserved Exactly) ─────────────────
    // ═════════════════════════════════════════════════════════════════════

    @IsTest
    static void testAggregationOnCreation() {
        Opportunity opp = [SELECT Id, Current_Total_Debt__c FROM Opportunity LIMIT 1];
        Assert.areEqual(1000.00, opp.Current_Total_Debt__c);
    }

    @IsTest
    static void testAggregationOnUpdation() {
        Test.startTest();
        Debt_Details__c debt       = [SELECT Id, Debt_Amount__c FROM Debt_Details__c LIMIT 1];
        debt.Debt_Amount__c        = 3500;
        debt.Negotiation_Status__c = 'Settled lump sum';
        OpportunityLockService.disableOppLockForSystemUpdates();
        update debt;
        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        Test.stopTest();

        Opportunity opp = [SELECT Id, Current_Total_Debt__c FROM Opportunity LIMIT 1];
        Assert.areEqual(3500.00, opp.Current_Total_Debt__c);
    }

    @IsTest
    static void testAggregationOnDeletion() {
        Test.startTest();
        Debt_Details__c debt = [SELECT Id FROM Debt_Details__c LIMIT 1];
        OpportunityLockService.disableOppLockForSystemUpdates();
        delete debt;
        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        Test.stopTest();

        Opportunity opp = [SELECT Id, Current_Total_Debt__c FROM Opportunity LIMIT 1];
        Assert.areEqual(0.00, opp.Current_Total_Debt__c);
    }

    // ═════════════════════════════════════════════════════════════════════
    // ── NEW TESTS (Legal Network Logic — Updated for Refactored Handler) ──
    // ═════════════════════════════════════════════════════════════════════
    //
    // KEY CHANGES vs old tests:
    //   • snapshotLegalNetworkOnDebtDetails() now runs in BEFORE context
    //     → sets DD.Legal_Network__c IN-MEMORY (zero DML on Debt_Details__c)
    //   • rollupLegalNetworkToOpportunity() runs in AFTER context
    //     → reads DD.Legal_Network__c (already stamped) to roll up to Opp
    //   • evaluateLegalNetworkType() reads dd.Legal_Network__c directly
    //     (no relationship traversal via Current_Creditor__r.Creditor_Category__c)
    //   • No recursion possible — DD DML is completely eliminated
    // ═════════════════════════════════════════════════════════════════════

    // ─────────────────────────────────────────────────────────────────────
    // Scenario 1: Insert — ALL creditors = VLP → Opportunity = Victory Legal Plan
    //
    // Flow: beforeInsert → snapshotLegalNetworkOnDebtDetails stamps
    //       DD.Legal_Network__c = VLP in-memory (no DML)
    //       afterInsert → rollupLegalNetworkToOpportunity reads
    //       DD.Legal_Network__c → all VLP → sets Opp.Legal_Network__c = VLP
    // ─────────────────────────────────────────────────────────────────────
    @IsTest
    static void testAffiliate_AllVLP_SetsVictoryLegalPlan() {
        Opportunity opp      = [SELECT Id, AccountId FROM Opportunity LIMIT 1];
        Account vlpCreditor1 = [SELECT Id FROM Account WHERE Name = 'VLP Creditor 1' LIMIT 1];
        Account vlpCreditor2 = [SELECT Id FROM Account WHERE Name = 'VLP Creditor 2' LIMIT 1];

        Test.startTest();
        OpportunityLockService.disableOppLockForSystemUpdates();

        // Remove base debt detail (no creditor) to isolate legal network logic
        delete [SELECT Id FROM Debt_Details__c WHERE Opportunity__c = :opp.Id];

        insert new List<Debt_Details__c>{
            new Debt_Details__c(
                Opportunity__c      = opp.Id,
                Current_Creditor__c = vlpCreditor1.Id,
                Debt_Amount__c      = 500,
                Account__c          = opp.AccountId
            ),
            new Debt_Details__c(
                Opportunity__c      = opp.Id,
                Current_Creditor__c = vlpCreditor2.Id,
                Debt_Amount__c      = 500,
                Account__c          = opp.AccountId
            )
        };

        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        Test.stopTest();

        // Verify DD.Legal_Network__c was stamped correctly in before context
        List<Debt_Details__c> stamped = [
            SELECT Legal_Network__c
            FROM Debt_Details__c
            WHERE Opportunity__c = :opp.Id
        ];
        for (Debt_Details__c dd : stamped) {
            Assert.areEqual(VLP, dd.Legal_Network__c,
                'beforeInsert must stamp DD.Legal_Network__c = VLP from Creditor_Category__c');
        }

        // Verify Opportunity rollup
        Opportunity result = [SELECT Legal_Network__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(VLP, result.Legal_Network__c,
            'All VLP creditors on insert → Opportunity Legal_Network__c must be Victory Legal Plan');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Scenario 2: Insert — ALL creditors = Citadel → Opportunity = Citadel
    //
    // Flow: beforeInsert stamps DD.Legal_Network__c = Citadel in-memory
    //       afterInsert rollup reads it → not all VLP → sets Opp = Citadel
    // ─────────────────────────────────────────────────────────────────────
    @IsTest
    static void testAffiliate_AllCitadel_SetsCitadel() {
        Opportunity opp         = [SELECT Id, AccountId FROM Opportunity LIMIT 1];
        Account citadelCreditor = [SELECT Id FROM Account WHERE Name = 'Citadel Creditor' LIMIT 1];

        Test.startTest();
        OpportunityLockService.disableOppLockForSystemUpdates();

        delete [SELECT Id FROM Debt_Details__c WHERE Opportunity__c = :opp.Id];

        insert new Debt_Details__c(
            Opportunity__c      = opp.Id,
            Current_Creditor__c = citadelCreditor.Id,
            Debt_Amount__c      = 800,
            Account__c          = opp.AccountId
        );

        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        Test.stopTest();

        // Verify DD.Legal_Network__c stamp
        Debt_Details__c stamped = [
            SELECT Legal_Network__c
            FROM Debt_Details__c
            WHERE Opportunity__c = :opp.Id
            LIMIT 1
        ];
        Assert.areEqual(CITADEL, stamped.Legal_Network__c,
            'beforeInsert must stamp DD.Legal_Network__c = Citadel from Creditor_Category__c');

        // Verify Opportunity rollup
        Opportunity result = [SELECT Legal_Network__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(CITADEL, result.Legal_Network__c,
            'All Citadel creditors on insert → Opportunity Legal_Network__c must be Citadel');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Scenario 3: Insert — Mixed (VLP + Citadel) → Opportunity = Citadel
    //
    // Flow: beforeInsert stamps each DD.Legal_Network__c correctly
    //       afterInsert rollup → not all VLP (one is Citadel) → Opp = Citadel
    // ─────────────────────────────────────────────────────────────────────
    @IsTest
    static void testAffiliate_MixedCreditors_SetsCitadel() {
        Opportunity opp         = [SELECT Id, AccountId FROM Opportunity LIMIT 1];
        Account vlpCreditor1    = [SELECT Id FROM Account WHERE Name = 'VLP Creditor 1' LIMIT 1];
        Account citadelCreditor = [SELECT Id FROM Account WHERE Name = 'Citadel Creditor' LIMIT 1];

        Test.startTest();
        OpportunityLockService.disableOppLockForSystemUpdates();

        delete [SELECT Id FROM Debt_Details__c WHERE Opportunity__c = :opp.Id];

        insert new List<Debt_Details__c>{
            new Debt_Details__c(
                Opportunity__c      = opp.Id,
                Current_Creditor__c = vlpCreditor1.Id,
                Debt_Amount__c      = 500,
                Account__c          = opp.AccountId
            ),
            new Debt_Details__c(
                Opportunity__c      = opp.Id,
                Current_Creditor__c = citadelCreditor.Id,
                Debt_Amount__c      = 500,
                Account__c          = opp.AccountId
            )
        };

        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        Test.stopTest();

        // Verify Opportunity rollup — one Citadel is enough to flip
        Opportunity result = [SELECT Legal_Network__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(CITADEL, result.Legal_Network__c,
            'Mixed creditors on insert → any Citadel wins → Opportunity Legal_Network__c must be Citadel');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Scenario 4: Update — Current_Creditor__c changes VLP → Citadel
    //
    // Flow: beforeUpdate → creditorChanged = true → stamps DD.Legal_Network__c
    //       = Citadel in-memory (no DML on DD, no recursion)
    //       afterUpdate → rollupLegalNetworkToOpportunity fires because
    //       creditor changed → reads updated DD.Legal_Network__c → Opp = Citadel
    // ─────────────────────────────────────────────────────────────────────
    @IsTest
    static void testAffiliate_UpdateCreditor_VLPtoCitadel() {
        Opportunity opp         = [SELECT Id, AccountId FROM Opportunity LIMIT 1];
        Account vlpCreditor1    = [SELECT Id FROM Account WHERE Name = 'VLP Creditor 1' LIMIT 1];
        Account citadelCreditor = [SELECT Id FROM Account WHERE Name = 'Citadel Creditor' LIMIT 1];

        // ── Step 1: Insert with VLP → sets Opportunity to VLP ─────────
        OpportunityLockService.disableOppLockForSystemUpdates();

        delete [SELECT Id FROM Debt_Details__c WHERE Opportunity__c = :opp.Id];

        Debt_Details__c debt = new Debt_Details__c(
            Opportunity__c      = opp.Id,
            Current_Creditor__c = vlpCreditor1.Id,
            Debt_Amount__c      = 1000,
            Account__c          = opp.AccountId
        );
        insert debt;
        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();

        // ── Step 2: Confirm VLP was set after insert ───────────────────
        Opportunity afterInsert = [SELECT Legal_Network__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(VLP, afterInsert.Legal_Network__c,
            'Before update: Opportunity Legal_Network__c should be Victory Legal Plan');

        // ── Step 3: Update Current_Creditor__c → beforeUpdate stamps
        //            DD.Legal_Network__c = Citadel in-memory (no DML on DD)
        //            afterUpdate rollup re-evaluates → Opp flips to Citadel
        Test.startTest();
        OpportunityLockService.disableOppLockForSystemUpdates();
        debt.Current_Creditor__c = citadelCreditor.Id;
        update debt;
        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        Test.stopTest();

        // Verify DD.Legal_Network__c was re-stamped in beforeUpdate
        Debt_Details__c restamp = [SELECT Legal_Network__c FROM Debt_Details__c WHERE Id = :debt.Id];
        Assert.areEqual(CITADEL, restamp.Legal_Network__c,
            'beforeUpdate must re-stamp DD.Legal_Network__c = Citadel when creditor changes');

        // Verify Opportunity rollup flipped
        Opportunity afterUpdate = [SELECT Legal_Network__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(CITADEL, afterUpdate.Legal_Network__c,
            'Changing Current_Creditor__c to Citadel → Opportunity Legal_Network__c must flip to Citadel');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Scenario 5: Update — Current_Creditor__c changes Citadel → VLP
    //
    // Flow: beforeUpdate stamps DD.Legal_Network__c = VLP in-memory
    //       afterUpdate rollup → all VLP → Opp flips to VLP
    // ─────────────────────────────────────────────────────────────────────
    @IsTest
    static void testAffiliate_UpdateCreditor_CitadelToVLP() {
        Opportunity opp         = [SELECT Id, AccountId FROM Opportunity LIMIT 1];
        Account vlpCreditor1    = [SELECT Id FROM Account WHERE Name = 'VLP Creditor 1' LIMIT 1];
        Account citadelCreditor = [SELECT Id FROM Account WHERE Name = 'Citadel Creditor' LIMIT 1];

        // ── Step 1: Insert with Citadel → sets Opportunity to Citadel ─
        OpportunityLockService.disableOppLockForSystemUpdates();

        delete [SELECT Id FROM Debt_Details__c WHERE Opportunity__c = :opp.Id];

        Debt_Details__c debt = new Debt_Details__c(
            Opportunity__c      = opp.Id,
            Current_Creditor__c = citadelCreditor.Id,
            Debt_Amount__c      = 1000,
            Account__c          = opp.AccountId
        );
        insert debt;
        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();

        // ── Step 2: Confirm Citadel was set after insert ───────────────
        Opportunity afterInsert = [SELECT Legal_Network__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(CITADEL, afterInsert.Legal_Network__c,
            'Before update: Opportunity Legal_Network__c should be Citadel');

        // ── Step 3: Update Current_Creditor__c → beforeUpdate stamps
        //            DD.Legal_Network__c = VLP in-memory (no DML on DD)
        //            afterUpdate rollup re-evaluates → Opp flips to VLP
        Test.startTest();
        OpportunityLockService.disableOppLockForSystemUpdates();
        debt.Current_Creditor__c = vlpCreditor1.Id;
        update debt;
        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        Test.stopTest();

        // Verify DD.Legal_Network__c was re-stamped in beforeUpdate
        Debt_Details__c restamp = [SELECT Legal_Network__c FROM Debt_Details__c WHERE Id = :debt.Id];
        Assert.areEqual(VLP, restamp.Legal_Network__c,
            'beforeUpdate must re-stamp DD.Legal_Network__c = VLP when creditor changes');

        // Verify Opportunity rollup flipped
        Opportunity afterUpdate = [SELECT Legal_Network__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(VLP, afterUpdate.Legal_Network__c,
            'Changing Current_Creditor__c to VLP → Opportunity Legal_Network__c must flip to Victory Legal Plan');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Scenario 6: Update — Other field changes (NOT Current_Creditor__c)
    //             beforeUpdate: creditorChanged = false → snapshot skipped
    //             afterUpdate:  creditorChanged = false → rollup skipped
    //             → Opportunity Legal_Network__c must NOT change
    // ─────────────────────────────────────────────────────────────────────
    @IsTest
    static void testAffiliate_UpdateNonCreditorField_NoReevaluation() {
        Opportunity opp         = [SELECT Id, AccountId FROM Opportunity LIMIT 1];
        Account citadelCreditor = [SELECT Id FROM Account WHERE Name = 'Citadel Creditor' LIMIT 1];

        // ── Step 1: Insert with Citadel → sets Opportunity to Citadel ─
        OpportunityLockService.disableOppLockForSystemUpdates();

        delete [SELECT Id FROM Debt_Details__c WHERE Opportunity__c = :opp.Id];

        Debt_Details__c debt = new Debt_Details__c(
            Opportunity__c      = opp.Id,
            Current_Creditor__c = citadelCreditor.Id,
            Debt_Amount__c      = 1000,
            Account__c          = opp.AccountId
        );
        insert debt;
        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();

        // ── Step 2: Capture current Legal_Network__c ───────────────────
        Opportunity afterInsert    = [SELECT Legal_Network__c FROM Opportunity WHERE Id = :opp.Id];
        String legalNetworkBefore  = afterInsert.Legal_Network__c;

        // ── Step 3: Update ONLY Debt_Amount__c — creditor unchanged
        //            beforeUpdate: creditorChanged = false → snapshot NOT called
        //            afterUpdate:  creditorChanged = false → rollup NOT called
        Test.startTest();
        OpportunityLockService.disableOppLockForSystemUpdates();
        debt.Debt_Amount__c = 9999;
        update debt;
        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        Test.stopTest();

        Opportunity afterUpdate = [SELECT Legal_Network__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(legalNetworkBefore, afterUpdate.Legal_Network__c,
            'Updating non-creditor field → creditorChanged = false → snapshot + rollup both skipped → Legal_Network__c must NOT change');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Scenario 7: Insert — Debt Detail with NO Current_Creditor__c
    //             beforeInsert: Current_Creditor__c = null → snapshot skipped
    //             afterInsert:  Current_Creditor__c = null → opportunityIds empty
    //             → rollup never fires → Opportunity Legal_Network__c unchanged
    // ─────────────────────────────────────────────────────────────────────
    @IsTest
    static void testAffiliate_NoCreditor_NoAffiliateChange() {
        Opportunity opp          = [SELECT Id, AccountId, Legal_Network__c FROM Opportunity LIMIT 1];
        String originalLegalNet  = opp.Legal_Network__c;

        Test.startTest();
        OpportunityLockService.disableOppLockForSystemUpdates();

        delete [SELECT Id FROM Debt_Details__c WHERE Opportunity__c = :opp.Id];

        // Insert with NO Current_Creditor__c — intentionally omitted
        insert new Debt_Details__c(
            Opportunity__c = opp.Id,
            Debt_Amount__c = 500,
            Account__c     = opp.AccountId
        );

        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        Test.stopTest();

        // Verify DD.Legal_Network__c was NOT stamped (creditor was null → skipped)
        Debt_Details__c noStamp = [
            SELECT Legal_Network__c
            FROM Debt_Details__c
            WHERE Opportunity__c = :opp.Id
            LIMIT 1
        ];
        Assert.isNull(noStamp.Legal_Network__c,
            'No creditor → beforeInsert snapshot skipped → DD.Legal_Network__c must remain null');

        // Verify Opportunity was not touched
        Opportunity result = [SELECT Legal_Network__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(originalLegalNet, result.Legal_Network__c,
            'No creditor → opportunityIds empty → rollup skipped → Opportunity Legal_Network__c must be unchanged');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Scenario 8: Bulk — 200 Debt Details all VLP → Opportunity = VLP
    //
    // Validates: single SOQL in snapshotLegalNetworkOnDebtDetails,
    //            no governor limit issues, all 200 DDs stamped correctly
    // ─────────────────────────────────────────────────────────────────────
    @IsTest
    static void testAffiliate_Bulk200_AllVLP() {
        Opportunity opp      = [SELECT Id, AccountId FROM Opportunity LIMIT 1];
        Account vlpCreditor1 = [SELECT Id FROM Account WHERE Name = 'VLP Creditor 1' LIMIT 1];

        Test.startTest();
        OpportunityLockService.disableOppLockForSystemUpdates();

        delete [SELECT Id FROM Debt_Details__c WHERE Opportunity__c = :opp.Id];

        List<Debt_Details__c> bulkList = new List<Debt_Details__c>();
        for (Integer i = 0; i < 200; i++) {
            bulkList.add(new Debt_Details__c(
                Opportunity__c      = opp.Id,
                Current_Creditor__c = vlpCreditor1.Id,
                Debt_Amount__c      = 100,
                Account__c          = opp.AccountId
            ));
        }
        insert bulkList;

        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        Test.stopTest();

        // Verify all 200 DDs were stamped in beforeInsert (in-memory, no DML)
        List<Debt_Details__c> stamped = [
            SELECT Legal_Network__c
            FROM Debt_Details__c
            WHERE Opportunity__c = :opp.Id
        ];
        Assert.areEqual(200, stamped.size(), 'All 200 Debt Details must be present');
        for (Debt_Details__c dd : stamped) {
            Assert.areEqual(VLP, dd.Legal_Network__c,
                'Every DD must have Legal_Network__c = VLP stamped in beforeInsert');
        }

        // Verify Opportunity rollup
        Opportunity result = [SELECT Legal_Network__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(VLP, result.Legal_Network__c,
            'Bulk 200 VLP debt details → Opportunity Legal_Network__c must be Victory Legal Plan');
    }

    // ─────────────────────────────────────────────────────────────────────
    // Scenario 9: Bulk — 199 VLP + 1 Citadel → Opportunity = Citadel
    //
    // Validates: "any non-VLP wins" rule holds at scale with early break,
    //            Citadel DD is stamped correctly, Opp flips despite 199 VLP
    // ─────────────────────────────────────────────────────────────────────
    @IsTest
    static void testAffiliate_Bulk200_OneCitadelWins() {
        Opportunity opp         = [SELECT Id, AccountId FROM Opportunity LIMIT 1];
        Account vlpCreditor1    = [SELECT Id FROM Account WHERE Name = 'VLP Creditor 1' LIMIT 1];
        Account citadelCreditor = [SELECT Id FROM Account WHERE Name = 'Citadel Creditor' LIMIT 1];

        Test.startTest();
        OpportunityLockService.disableOppLockForSystemUpdates();

        delete [SELECT Id FROM Debt_Details__c WHERE Opportunity__c = :opp.Id];

        List<Debt_Details__c> bulkList = new List<Debt_Details__c>();

        // 199 VLP records
        for (Integer i = 0; i < 199; i++) {
            bulkList.add(new Debt_Details__c(
                Opportunity__c      = opp.Id,
                Current_Creditor__c = vlpCreditor1.Id,
                Debt_Amount__c      = 100,
                Account__c          = opp.AccountId
            ));
        }
        // 1 Citadel — must flip the entire result
        bulkList.add(new Debt_Details__c(
            Opportunity__c      = opp.Id,
            Current_Creditor__c = citadelCreditor.Id,
            Debt_Amount__c      = 100,
            Account__c          = opp.AccountId
        ));

        insert bulkList;

        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        Test.stopTest();

        // Verify the Citadel DD was stamped correctly in beforeInsert
        List<Debt_Details__c> citadelDDs = [
            SELECT Legal_Network__c
            FROM Debt_Details__c
            WHERE Opportunity__c = :opp.Id
            AND Current_Creditor__c = :citadelCreditor.Id
        ];
        Assert.areEqual(1, citadelDDs.size(), 'Exactly one Citadel DD must exist');
        Assert.areEqual(CITADEL, citadelDDs[0].Legal_Network__c,
            'The Citadel DD must have Legal_Network__c = Citadel stamped in beforeInsert');

        // Verify Opportunity rollup — one Citadel beats 199 VLP
        Opportunity result = [SELECT Legal_Network__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(CITADEL, result.Legal_Network__c,
            '199 VLP + 1 Citadel → even one Citadel must set Opportunity Legal_Network__c to Citadel');
    }
}