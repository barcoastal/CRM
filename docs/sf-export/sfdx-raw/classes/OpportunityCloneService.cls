public without sharing class OpportunityCloneService {

    @AuraEnabled
    public static Id cloneOpportunity(Id activeOppId) {

        if (activeOppId == null) {
            throw new AuraHandledException('Active Opportunity Id is required');
        }

        List<Opportunity> oppList = OpportunityData.getChildOpportunityList(activeOppId);
        if(oppList.size() > 0) {
            throw new AuraHandledException('Draft amendment opportunity already exists. Creation of a new one is not allowed.');
        }

       	Map<String, String> childApiToRelationship = new Map<String, String>{
            'Program_Plan__c' => 'Program_Plans1__r',
            'Debt_Details__c' => 'Debt_Details__r',
            'OpportunityLineItem'=>'OpportunityLineItems'
        };
        
        String soql = OpportunityCloneUtil.buildParentChildQuery(
            'Opportunity',
            childApiToRelationship,
            activeOppId
        );

        Opportunity activeOpp = Database.query(soql);

        Opportunity draftOpp = cloneOpportunityRecord(activeOpp);
        draftOpp.Opportunity__c = activeOpp.Id;
        insert draftOpp;

        cloneProgramPlans(activeOpp.Program_Plans1__r, draftOpp.Id);
        cloneDebtDetails(activeOpp.Debt_Details__r, draftOpp.Id);
        cloneOpportunityLineItem(activeOpp.OpportunityLineItems, draftOpp.Id);
        
        Opportunity oppToUpdate = new Opportunity();
        oppToUpdate.Id = activeOpp.Id;
        oppToUpdate.Opportunity_Amended_DateTime__c = System.now();
        OpportunityLockService.disableOppLockForSystemUpdates();
        update oppToUpdate;
        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();

        return draftOpp.Id;
    }

    private static Opportunity cloneOpportunityRecord(Opportunity source) {
        Opportunity draft = source.clone(false, false, false, false);
        draft.StageName = 'Working Opportunity';
        draft.Sub_Disposition__c = 'Stage Change';
        draft.Version_Status__c = 'Draft';
		String baseName = source.Name;

        if (baseName.contains('- V')) {
			baseName = baseName.substring(0, baseName.indexOf('- V'));
		}

		draft.Name = baseName + ' - V' + String.valueOf(
			(source.Version__c == null ? 1 : source.Version__c) + 1
		);
		draft.Version__c = (source.Version__c == null ? 1 : source.Version__c) + 1;
        return draft;
    }

    private static void cloneProgramPlans(List<Program_Plan__c> sourcePlans, Id newOppId) {

        List<Program_Plan__c> newPlans = new List<Program_Plan__c>();
        for (Program_Plan__c oldPlan : sourcePlans) {
            Program_Plan__c newPlan = oldPlan.clone(false, false, false, false);
            newPlan.Opportunity__c = newOppId;
            newPlan.Last_Rescheduled_By__c = null;
            newPlan.Last_Rescheduled_Date_Time__c = null;
            newPlans.add(newPlan);
        }
        insert newPlans;
    }
    
    private static void cloneDebtDetails(List<Debt_Details__c> sourceDetails, Id newOppId) {
        List<Debt_Details__c> newDetails = new List<Debt_Details__c>();
        for (Debt_Details__c oldDetail : sourceDetails) {
            Debt_Details__c newDetail = oldDetail.clone(false, false, false, false);
            newDetail.Opportunity__c = newOppId;
            newDetail.Parent_Debt_Detail__c = oldDetail.Id;
            newDetails.add(newDetail);
        }
        insert newDetails;
    }
    private static void cloneOpportunityLineItem(List<OpportunityLineItem> sourceOpli, Id newOppId) {
        List<OpportunityLineItem> newOplis = new List<OpportunityLineItem>();
        for (OpportunityLineItem oldDetail : sourceOpli) {
            OpportunityLineItem newOpli = oldDetail.clone(false, false, false, false);
            newOpli.OpportunityId = newOppId;
            //Added null because only one of unit price or total price may be specified
            newOpli.TotalPrice = null;
            newOplis.add(newOpli);
        }
        insert newOplis;
    }
}