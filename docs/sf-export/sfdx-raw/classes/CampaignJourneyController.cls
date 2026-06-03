public with sharing class CampaignJourneyController {

    // Enhanced Wrapper class - tells the full Lead and Contact story
    public class MemberWrapper {
        @AuraEnabled public String memberId;           // CampaignMember Id
        @AuraEnabled public String memberType;         // 'Lead' or 'Contact'
        @AuraEnabled public String leadId;             // Lead Id (if Lead)
        @AuraEnabled public String contactId;          // Contact Id (if Contact)
        @AuraEnabled public String name;               // Lead/Contact Name
        @AuraEnabled public String email;              // Lead/Contact Email
        @AuraEnabled public String status;             // Campaign Member Status
        @AuraEnabled public String leadStatus;         // Lead.Status (if Lead) - e.g., New, Working, Qualified
        @AuraEnabled public String leadSource;         // Lead.LeadSource (if Lead) or derived from Opportunity (if Contact)
        @AuraEnabled public Boolean   isConverted;     // True if Lead was converted
        @AuraEnabled public String convertedTo;        // 'Contact & Opportunity' or null
        @AuraEnabled public String opportunityId;      // Linked Opportunity Id
        @AuraEnabled public String opportunityName;    // Linked Opportunity Name
        @AuraEnabled public String opportunityStage;   // Linked Opportunity Stage
        @AuraEnabled public Decimal opportunityAmount; // Linked Opportunity Amount
        @AuraEnabled public Integer incomingCallCount; // Number of incoming Five9 calls
        @AuraEnabled public Integer textMessageCount;  // Number of Account Engagement text messages sent
        @AuraEnabled public Integer totalSmsMessageCount; // Total number of SMS messages sent (all sources)
        @AuraEnabled public Integer accountEngagementResponseCount; // Account Engagement message responses
        @AuraEnabled public Integer totalResponseCount; // Total SMS responses (all sources)
        @AuraEnabled public Decimal currentDebt;       // Current_Total_Debt__c from Opportunity
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getJourneyData(Id campaignId) {
        Long startTime = System.currentTimeMillis();
        System.debug(LoggingLevel.DEBUG, '=== CampaignJourneyController.getJourneyData START ===');
        System.debug(LoggingLevel.DEBUG, 'campaignId: ' + campaignId);
        System.debug(LoggingLevel.DEBUG, 'Timestamp: ' + System.now());
        
        Map<String, Object> result = new Map<String, Object>{
            'totalMembers' => 0,
            'totalLeads' => 0,
            'totalContacts' => 0,
            'unconvertedLeads' => 0,
            'convertedLeads' => 0,
            'totalOpportunities' => 0,
            'closedWonOpportunities' => 0,
            'closedWonDebt' => 0.00,
            'otherOpportunityDebt' => 0.00,
            'totalTextMessagesSent' => 0,
            'totalSmsMessagesSent' => 0,
            'accountEngagementResponses' => 0,
            'totalSmsResponses' => 0,
            'textMessagesByActionType' => new Map<String, Integer>(),
            'textMessagesByDateAndAction' => new Map<String, Map<String, Integer>>(),
            'closedWonBySource' => new Map<String, Integer>(),
            'members' => new List<MemberWrapper>()
        };
        System.debug(LoggingLevel.DEBUG, 'Result map initialized with ' + result.size() + ' keys');

        // Query CampaignMembers with Lead details
        System.debug(LoggingLevel.DEBUG, 'Querying campaign members for campaignId: ' + campaignId);
        List<CampaignMember> members = [
            SELECT Id, CreatedDate, Status,
                   LeadId, Lead.Name, Lead.Email, Lead.Status, Lead.LeadSource, Lead.IsConverted,
                   Lead.ConvertedContactId, Lead.ConvertedOpportunityId,
                   ContactId, Contact.Name, Contact.Email
            FROM CampaignMember
            WHERE CampaignId = :campaignId
        ];
        System.debug(LoggingLevel.DEBUG, 'Retrieved ' + members.size() + ' campaign members');

        // Query the Campaign itself for standard rollup counts
        System.debug(LoggingLevel.DEBUG, 'Querying campaign details...');
        Campaign campaign = [
            SELECT Name, NumberOfLeads, NumberOfContacts, NumberOfConvertedLeads, NumberOfOpportunities
            FROM Campaign
            WHERE Id = :campaignId
            LIMIT 1
        ];
        System.debug(LoggingLevel.DEBUG, 'Campaign: NumberOfLeads=' + campaign.NumberOfLeads + 
                     ', NumberOfContacts=' + campaign.NumberOfContacts + 
                     ', NumberOfConvertedLeads=' + campaign.NumberOfConvertedLeads + 
                     ', NumberOfOpportunities=' + campaign.NumberOfOpportunities);

        result.put('totalMembers', members.size());
        System.debug(LoggingLevel.DEBUG, 'Total members set to: ' + members.size());
        result.put('totalLeads', campaign.NumberOfLeads != null ? campaign.NumberOfLeads : 0);
        result.put('totalContacts', campaign.NumberOfContacts != null ? campaign.NumberOfContacts : 0);

        // Declare member breakdown counters
        Integer leadMemberCount = 0;
        Integer contactMemberCount = 0;
        Integer bothLeadAndContactCount = 0;
        Integer neitherCount = 0;
        Map<String, Integer> leadStatusCounts = new Map<String, Integer>();
        Map<String, Integer> memberStatusCounts = new Map<String, Integer>();
        
        // Count member breakdown
        for (CampaignMember cm : members) {
            if (cm.LeadId != null && cm.ContactId != null) {
                bothLeadAndContactCount++;
            } else if (cm.LeadId != null) {
                leadMemberCount++;
            } else if (cm.ContactId != null) {
                contactMemberCount++;
            } else {
                neitherCount++;
            }
            
            if (cm.LeadId != null && cm.Lead.Status != null) {
                String status = cm.Lead.Status;
                leadStatusCounts.put(status, (leadStatusCounts.containsKey(status) ? leadStatusCounts.get(status) : 0) + 1);
            }
            
            String cmStatus = cm.Status != null ? cm.Status : 'NULL';
            memberStatusCounts.put(cmStatus, (memberStatusCounts.containsKey(cmStatus) ? memberStatusCounts.get(cmStatus) : 0) + 1);
        }

        // Analyze and debug campaign member breakdown
        analyzeCampaignMemberBreakdown(members, campaign);

        // Collect IDs for bulk queries
        Map<String, Object> idCollectionResult = collectCampaignMemberIds(members);
        Set<Id> contactIds = (Set<Id>) idCollectionResult.get('contactIds');
        Set<Id> leadIds = (Set<Id>) idCollectionResult.get('leadIds');
        Set<Id> convertedContactIds = (Set<Id>) idCollectionResult.get('convertedContactIds');

        // Opportunities via Contact Roles (includes converted Leads)
        Map<Id, Opportunity> contactOppMap = new Map<Id, Opportunity>();
        Set<Id> allContactIds = new Set<Id>();
        allContactIds.addAll(contactIds);
        allContactIds.addAll(convertedContactIds);

        // Map contact ID to its Lead_Number__c for SMS aggregation
        Map<Id, String> contactToLeadNumberMap = new Map<Id, String>();

        // Query contacts to get their Lead_Number__c field
        if (!allContactIds.isEmpty()) {
            for (Contact c : [SELECT Id, Lead_Number__c FROM Contact WHERE Id IN :allContactIds]) {
                if (c.Lead_Number__c != null) {
                    contactToLeadNumberMap.put(c.Id, c.Lead_Number__c);
                }
            }
        }

        if (!allContactIds.isEmpty()) {
            for (OpportunityContactRole ocr : [
                SELECT ContactId, Opportunity.Id, Opportunity.Name, Opportunity.StageName, Opportunity.Amount, Opportunity.Current_Total_Debt__c, Opportunity.LeadSource
                FROM OpportunityContactRole
                WHERE ContactId IN :allContactIds
            ]) {
                if (!contactOppMap.containsKey(ocr.ContactId)) {
                    contactOppMap.put(ocr.ContactId, ocr.Opportunity);
                }
            }
        }

        // Fallback: Direct ConvertedOpportunity for Leads
        Map<Id, Opportunity> convertedOppMap = new Map<Id, Opportunity>();
        List<Lead> convertedLeadsList = [
            SELECT Id, ConvertedOpportunityId, ConvertedOpportunity.Name,
                   ConvertedOpportunity.StageName, ConvertedOpportunity.Amount, ConvertedOpportunity.Current_Total_Debt__c, ConvertedOpportunity.LeadSource
            FROM Lead
            WHERE Id IN :leadIds AND IsConverted = true AND ConvertedOpportunityId != null
        ];
        for (Lead l : convertedLeadsList) {
            convertedOppMap.put(l.Id, l.ConvertedOpportunity);
        }

        // Query Five9 Call Logs for incoming calls related to campaign leads
        Map<Id, Integer> leadIncomingCallCountMap = new Map<Id, Integer>();
        try {
            List<AggregateResult> callAggregates = [
                SELECT Lead__c, COUNT(Id) callCount
                FROM Five9_Call_Log__c
                WHERE Lead__c IN :leadIds AND Campaign_Name__c LIKE '%Inbound%'
                GROUP BY Lead__c
            ];
            for (AggregateResult ar : callAggregates) {
                Id leadId = (Id) ar.get('Lead__c');
                Integer count = (Integer) ar.get('callCount');
                leadIncomingCallCountMap.put(leadId, count);
            }
        } catch (Exception e) {
            // Five9_Call_Log__c may not exist or query may fail - continue gracefully
            System.debug('Five9 Call Log query failed (object may not exist): ' + e.getMessage());
        }

        // Aggregates for Lead story
        Integer totalLeads = (campaign.NumberOfLeads != null ? campaign.NumberOfLeads : 0);
        Integer convertedLeads = (campaign.NumberOfConvertedLeads != null ? campaign.NumberOfConvertedLeads : 0);
        Integer unconvertedLeads = totalLeads - convertedLeads;
        Set<Id> allOppIds = new Set<Id>();
        Integer wonCount = 0;
        Decimal closedWonDebt = 0.00;
        Decimal otherOppDebt = 0.00;

        Map<String, Integer> closedWonBySourceMap = (Map<String, Integer>) result.get('closedWonBySource');
        List<MemberWrapper> wrappers = buildMemberWrappers(
            members,
            contactOppMap,
            convertedOppMap,
            leadIncomingCallCountMap,
            allOppIds,
            closedWonBySourceMap
        );

        // Calculate debt aggregates from wrappers
        for (MemberWrapper w : wrappers) {
            if (w.opportunityStage == 'Closed Won First Payment Pending' || 
                w.opportunityStage == 'Closed Won - First Payment Completed') {
                wonCount++;
                if (w.currentDebt != null) {
                    closedWonDebt += w.currentDebt;
                }
            } else if (w.opportunityStage != null) {
                if (w.currentDebt != null) {
                    otherOppDebt += w.currentDebt;
                }
            }
        }
        
        // ===== DEBUG: Opportunity Stage Analysis =====
        System.debug(LoggingLevel.DEBUG, '===== OPPORTUNITY STAGE ANALYSIS =====');
        System.debug(LoggingLevel.DEBUG, 'Total opportunities found in members: ' + allOppIds.size());
        System.debug(LoggingLevel.DEBUG, 'Closed Won count (calculated): ' + wonCount);
        System.debug(LoggingLevel.DEBUG, 'Campaign.NumberOfOpportunities: ' + (campaign.NumberOfOpportunities != null ? String.valueOf(campaign.NumberOfOpportunities) : 'NULL'));
        System.debug(LoggingLevel.DEBUG, '');
        
        // Get all opportunities and their stages for detailed analysis
        Map<String, Integer> oppStageCounts = new Map<String, Integer>();
        Map<String, Integer> oppConvertedLeadStatus = new Map<String, Integer>();
        
        List<Opportunity> allOpps = [
            SELECT Id, StageName, LeadSource, AccountId, Account.Name, Amount, Current_Total_Debt__c
            FROM Opportunity
            WHERE Id IN :allOppIds
        ];
        
        System.debug(LoggingLevel.DEBUG, 'All Opportunities Query Results: ' + allOpps.size() + ' opportunities');
        for (Opportunity opp : allOpps) {
            String stage = opp.StageName != null ? opp.StageName : 'NULL';
            oppStageCounts.put(stage, (oppStageCounts.containsKey(stage) ? oppStageCounts.get(stage) : 0) + 1);
        }
        
        System.debug(LoggingLevel.DEBUG, 'Opportunity Stage Breakdown:');
        for (String stage : oppStageCounts.keySet()) {
            System.debug(LoggingLevel.DEBUG, '  - ' + stage + ': ' + oppStageCounts.get(stage));
        }
        System.debug(LoggingLevel.DEBUG, '');

        result.put('totalLeads', campaign.NumberOfLeads != null ? campaign.NumberOfLeads : 0);
        result.put('totalContacts', campaign.NumberOfContacts != null ? campaign.NumberOfContacts : 0);
        result.put('unconvertedLeads', unconvertedLeads);
        result.put('convertedLeads', convertedLeads);
        // Note: totalOpportunities and closedWonOpportunities will be updated after cumulative calculation
        result.put('totalOpportunities', campaign.NumberOfOpportunities != null ? campaign.NumberOfOpportunities : 0);
        result.put('closedWonOpportunities', wonCount);
        result.put('closedWonDebt', closedWonDebt);
        result.put('otherOpportunityDebt', otherOppDebt);
        result.put('members', wrappers);

        // Calculate Leads by Created Date
        Map<String, Integer> leadsByDateMap = new Map<String, Integer>();
        try {
            List<Lead> campaignLeads = [
                SELECT Id, CreatedDate
                FROM Lead
                WHERE Id IN :leadIds
            ];
            
            for (Lead l : campaignLeads) {
                String dateStr = l.CreatedDate.format('yyyy-MM-dd');
                if (!leadsByDateMap.containsKey(dateStr)) {
                    leadsByDateMap.put(dateStr, 0);
                }
                leadsByDateMap.put(dateStr, leadsByDateMap.get(dateStr) + 1);
            }
            
            result.put('leadsByDate', leadsByDateMap);
        } catch (Exception e) {
            System.debug('Error calculating leads by date: ' + e.getMessage());
            result.put('leadsByDate', new Map<String, Integer>());
        }

        // Query SMS Magic text messages sent for "Leads Coastal Debt Welcome Flow"
        Map<Id, Integer> leadTextMessageCountMap = new Map<Id, Integer>();
        Map<Id, Integer> contactTextMessageCountMap = new Map<Id, Integer>();
        Map<String, Integer> leadNumberTextMessageCountMap = new Map<String, Integer>();  // Map Lead_Number__c to SMS count
        Map<Id, Integer> leadAEResponseCountMap = new Map<Id, Integer>();  // AE responses by Lead
        Map<Id, Integer> contactAEResponseCountMap = new Map<Id, Integer>();  // AE responses by Contact
        Map<String, Integer> textMessagesByDateMap = new Map<String, Integer>();
        Map<String, Integer> textMessagesByActionTypeMap = new Map<String, Integer>();  // Map action name to count
        Map<String, Integer> aeMessageResponsesMap = new Map<String, Integer>();  // AE message responses by action type - Maps action name to response count
        Map<String, Map<String, Integer>> textMessagesByDateAndActionMap = new Map<String, Map<String, Integer>>();  // date -> (action -> count)
        Map<String, Map<String, Integer>> heatmapByDayHour = new Map<String, Map<String, Integer>>();  // day -> (hour -> count)
        Map<String, Map<String, Integer>> inboundHeatmapByDayHour = new Map<String, Map<String, Integer>>();  // inbound day -> (hour -> count)
        Integer totalAETextMessagesSent = 0;
        Integer totalAEResponses = 0;
        
        System.debug(LoggingLevel.DEBUG, '=== SMS MAGIC DATA PROCESSING START ===');
        System.debug(LoggingLevel.DEBUG, 'leadIds count: ' + leadIds.size() + ', contactIds count: ' + contactIds.size());
        
        try {
            System.debug(LoggingLevel.DEBUG, 'Querying Converse Apps with name "Leads Coastal Debt Welcome Flow"...');
            // Get the Converse App for "Leads Coastal Debt Welcome Flow"
            List<smagicinteract__Converse_App__c> converseApps = [
                SELECT Id
                FROM smagicinteract__Converse_App__c
                WHERE Name = 'Leads Coastal Debt Welcome Flow'
                LIMIT 1
            ];
            System.debug(LoggingLevel.DEBUG, 'Found ' + converseApps.size() + ' converse app(s)');
            
            // Track which Leads/Contacts are part of AE tasks
            Set<Id> aeMemberLeadIds = new Set<Id>();
            Set<Id> aeMemberContactIds = new Set<Id>();
            
            if (!converseApps.isEmpty()) {
                Id converseAppId = converseApps[0].Id;
                
                // Query outbound smsMagic records directly that are linked to this Converse App
                List<smagicinteract__smsMagic__c> aeOutboundSms = [
                    SELECT Id, smagicinteract__Lead__c, smagicinteract__Contact__c, smagicinteract__Converse_App_Action__c, CreatedDate
                    FROM smagicinteract__smsMagic__c
                    WHERE smagicinteract__Direction__c = 'OUT'
                    AND smagicinteract__Converse_App__c = :converseAppId
                    AND (smagicinteract__Lead__c IN :leadIds 
                         OR smagicinteract__Contact__c IN :contactIds)
                ];
                
                totalAETextMessagesSent = aeOutboundSms.size();
                
                System.debug(LoggingLevel.DEBUG, 'Account Engagement outbound SMS retrieved: ' + totalAETextMessagesSent + ' messages');
                
                // Get all Converse App Actions for this app with their names
                Map<Id, String> actionIdToNameMap = new Map<Id, String>();
                List<smagicinteract__Converse_App_Action__c> appActions = [
                    SELECT Id, Name
                    FROM smagicinteract__Converse_App_Action__c
                    WHERE smagicinteract__Converse_App__c = :converseAppId
                ];
                
                for (smagicinteract__Converse_App_Action__c action : appActions) {
                    actionIdToNameMap.put(action.Id, action.Name);
                }
                
                // Build maps from actual SMS messages
                processOutboundSmsMagicRecords(
                    aeOutboundSms,
                    actionIdToNameMap,
                    leadTextMessageCountMap,
                    contactTextMessageCountMap,
                    textMessagesByActionTypeMap,
                    textMessagesByDateMap,
                    textMessagesByDateAndActionMap,
                    heatmapByDayHour,
                    aeMemberLeadIds,
                    aeMemberContactIds
                );
                
                // Query inbound SMS for AE members to count responses and match to outbound messages
                List<smagicinteract__smsMagic__c> aeResponses = [
                    SELECT Id, smagicinteract__Lead__c, smagicinteract__Contact__c, CreatedDate
                    FROM smagicinteract__smsMagic__c
                    WHERE smagicinteract__Direction__c = 'IN'
                    AND (smagicinteract__Lead__c IN :aeMemberLeadIds 
                         OR smagicinteract__Contact__c IN :aeMemberContactIds)
                ];
                
                totalAEResponses = aeResponses.size();
                
                System.debug(LoggingLevel.DEBUG, 'Account Engagement responses retrieved: ' + totalAEResponses);
                
                // Build map of outbound AE SMS for matching with inbound
                Map<Id, List<smagicinteract__smsMagic__c>> leadOutboundAeMap = new Map<Id, List<smagicinteract__smsMagic__c>>();
                Map<Id, List<smagicinteract__smsMagic__c>> contactOutboundAeMap = new Map<Id, List<smagicinteract__smsMagic__c>>();
                buildOutboundSmsMap(aeOutboundSms, leadOutboundAeMap, contactOutboundAeMap);
                
                // Count AE responses by Lead/Contact and match to outbound messages
                matchAEResponsesToOutbound(aeResponses, leadOutboundAeMap, contactOutboundAeMap, leadAEResponseCountMap, contactAEResponseCountMap, actionIdToNameMap, aeMessageResponsesMap);
            }
            
            result.put('totalAETextMessagesSent', totalAETextMessagesSent);
            result.put('accountEngagementResponses', totalAEResponses);
            result.put('aeMessageResponses', aeMessageResponsesMap);  // AE messages by action type and response count
            result.put('textMessagesByDate', textMessagesByDateMap);
            result.put('textMessagesByActionType', textMessagesByActionTypeMap);
            result.put('textMessagesByDateAndAction', textMessagesByDateAndActionMap);
            
            // Convert heatmap to serializable format for AuraEnabled
            Map<String, Object> heatmapSerialized = serializeHeatmapData(heatmapByDayHour);
            result.put('messageHeatmap', heatmapSerialized);
        } catch (Exception e) {
            // SMS Magic objects may not exist or query may fail - continue gracefully
            System.debug('SMS Magic query failed: ' + e.getMessage());
            result.put('totalAETextMessagesSent', 0);
            result.put('accountEngagementResponses', 0);
            result.put('aeMessageResponses', new Map<String, Integer>());
            result.put('textMessagesByDate', new Map<String, Integer>());
            result.put('textMessagesByActionType', new Map<String, Integer>());
            result.put('textMessagesByDateAndAction', new Map<String, Map<String, Integer>>());
            result.put('messageHeatmap', new Map<String, Map<String, Integer>>());
        }

        // Query ALL SMS Magic messages (not just Account Engagement) for campaign members
        Map<Id, Integer> leadTotalSmsCountMap = new Map<Id, Integer>();
        Map<Id, Integer> contactTotalSmsCountMap = new Map<Id, Integer>();
        Map<Id, Integer> leadSmsResponseCountMap = new Map<Id, Integer>();
        Map<Id, Integer> contactSmsResponseCountMap = new Map<Id, Integer>();
        Integer totalAllSmsMessagesSent = 0;
        Integer totalAllSmsResponses = 0;
        
        try {
            // Query outbound SMS (Direction = 'OUT') for campaign members - include CreatedDate for heatmap
            List<smagicinteract__smsMagic__c> outboundSms = [
                SELECT Id, smagicinteract__Lead__c, smagicinteract__Contact__c, CreatedDate
                FROM smagicinteract__smsMagic__c
                WHERE smagicinteract__Direction__c = 'OUT'
                AND (smagicinteract__Lead__c IN :leadIds 
                     OR smagicinteract__Contact__c IN :contactIds)
            ];
            
            totalAllSmsMessagesSent = outboundSms.size();
            
            // Count outbound SMS by Lead/Contact and build heatmap if AE heatmap is empty
            for (smagicinteract__smsMagic__c sms : outboundSms) {
                if (sms.smagicinteract__Lead__c != null) {
                    Id leadId = sms.smagicinteract__Lead__c;
                    leadTotalSmsCountMap.put(
                        leadId,
                        leadTotalSmsCountMap.containsKey(leadId) ? leadTotalSmsCountMap.get(leadId) + 1 : 1
                    );
                }
                if (sms.smagicinteract__Contact__c != null) {
                    Id contactId = sms.smagicinteract__Contact__c;
                    contactTotalSmsCountMap.put(
                        contactId,
                        contactTotalSmsCountMap.containsKey(contactId) ? contactTotalSmsCountMap.get(contactId) + 1 : 1
                    );
                }
                
                // Build fallback heatmap from all SMS - always populate if data exists
                if (sms.CreatedDate != null) {
                    Integer hourOfDay = sms.CreatedDate.hour();
                    String dayOfWeekStr = sms.CreatedDate.format('EEEE');
                    
                    if (!heatmapByDayHour.containsKey(dayOfWeekStr)) {
                        heatmapByDayHour.put(dayOfWeekStr, new Map<String, Integer>());
                    }
                    Map<String, Integer> hourCounts = heatmapByDayHour.get(dayOfWeekStr);
                    String hourKey = String.valueOf(hourOfDay);
                    hourCounts.put(
                        hourKey,
                        hourCounts.containsKey(hourKey) ? hourCounts.get(hourKey) + 1 : 1
                    );
                }
            }
            
            // Query inbound SMS (Direction = 'IN') for campaign members to find responses
            List<smagicinteract__smsMagic__c> inboundSms = [
                SELECT Id, smagicinteract__Lead__c, smagicinteract__Contact__c, CreatedDate
                FROM smagicinteract__smsMagic__c
                WHERE smagicinteract__Direction__c = 'IN'
                AND (smagicinteract__Lead__c IN :leadIds 
                     OR smagicinteract__Contact__c IN :contactIds)
            ];
            
            totalAllSmsResponses = inboundSms.size();
            
            // Count inbound SMS (responses) by Lead/Contact
            for (smagicinteract__smsMagic__c sms : inboundSms) {
                if (sms.smagicinteract__Lead__c != null) {
                    Id leadId = sms.smagicinteract__Lead__c;
                    leadSmsResponseCountMap.put(
                        leadId,
                        leadSmsResponseCountMap.containsKey(leadId) ? leadSmsResponseCountMap.get(leadId) + 1 : 1
                    );
                }
                if (sms.smagicinteract__Contact__c != null) {
                    Id contactId = sms.smagicinteract__Contact__c;
                    contactSmsResponseCountMap.put(
                        contactId,
                        contactSmsResponseCountMap.containsKey(contactId) ? contactSmsResponseCountMap.get(contactId) + 1 : 1
                    );
                }
                
                // Build inbound heatmap
                if (sms.CreatedDate != null) {
                    Integer hourOfDay = sms.CreatedDate.hour();
                    String dayOfWeekStr = sms.CreatedDate.format('EEEE');
                    
                    if (!inboundHeatmapByDayHour.containsKey(dayOfWeekStr)) {
                        inboundHeatmapByDayHour.put(dayOfWeekStr, new Map<String, Integer>());
                    }
                    Map<String, Integer> hourCounts = inboundHeatmapByDayHour.get(dayOfWeekStr);
                    String hourKey = String.valueOf(hourOfDay);
                    hourCounts.put(
                        hourKey,
                        hourCounts.containsKey(hourKey) ? hourCounts.get(hourKey) + 1 : 1
                    );
                }
            }
            
            result.put('totalSmsMessagesSent', totalAllSmsMessagesSent);
            result.put('totalSmsResponses', totalAllSmsResponses);
        } catch (Exception e) {
            // SMS Magic objects may not exist or query may fail - continue gracefully
            System.debug('SMS Magic messages query failed: ' + e.getMessage());
            result.put('totalSmsMessagesSent', 0);
            result.put('totalSmsResponses', 0);
        }

        // Serialize inbound heatmap for LWC
        Map<String, Map<String, Integer>> inboundHeatmapSerialized = new Map<String, Map<String, Integer>>();
        for (String day : inboundHeatmapByDayHour.keySet()) {
            Map<String, Integer> hourMap = inboundHeatmapByDayHour.get(day);
            Map<String, Integer> hourMapObj = new Map<String, Integer>();
            for (String hour : hourMap.keySet()) {
                hourMapObj.put(hour, hourMap.get(hour));
            }
            inboundHeatmapSerialized.put(day, hourMapObj);
        }
        result.put('inboundMessageHeatmap', inboundHeatmapSerialized);
        
        // Update wrappers with text message counts and responses
        // For Leads: count if smagicinteract__Lead__c matches Lead.Id
        // For Contacts: count if smagicinteract__Contact__c matches Contact.Id OR CDR_Lead_ID matches Contact.Lead_Number__c
        for (CampaignJourneyController.MemberWrapper w : wrappers) {
            if (w.memberType == 'Lead' && w.leadId != null) {
                // For Leads: Account Engagement sent count
                w.textMessageCount = leadTextMessageCountMap.containsKey(w.leadId) 
                    ? leadTextMessageCountMap.get(w.leadId) 
                    : 0;
                // Total SMS sent count
                w.totalSmsMessageCount = leadTotalSmsCountMap.containsKey(w.leadId) 
                    ? leadTotalSmsCountMap.get(w.leadId) 
                    : 0;
                // Account Engagement responses
                w.accountEngagementResponseCount = leadAEResponseCountMap.containsKey(w.leadId) 
                    ? leadAEResponseCountMap.get(w.leadId) 
                    : 0;
                // Total SMS responses
                w.totalResponseCount = leadSmsResponseCountMap.containsKey(w.leadId) 
                    ? leadSmsResponseCountMap.get(w.leadId) 
                    : 0;
            } else if (w.memberType == 'Contact' && w.contactId != null) {
                // For Contacts: count both direct contact tasks and tasks matching the contact's Lead_Number__c via CDR_Lead_ID
                Integer contactTaskCount = contactTextMessageCountMap.containsKey(w.contactId) 
                    ? contactTextMessageCountMap.get(w.contactId) 
                    : 0;
                
                // Also add tasks that match the contact's Lead_Number__c via CDR_Lead_ID
                if (contactToLeadNumberMap.containsKey(w.contactId)) {
                    String contactLeadNumber = contactToLeadNumberMap.get(w.contactId);
                    if (contactLeadNumber != null) {
                        Integer leadNumberTaskCount = leadNumberTextMessageCountMap.containsKey(contactLeadNumber)
                            ? leadNumberTextMessageCountMap.get(contactLeadNumber)
                            : 0;
                        contactTaskCount += leadNumberTaskCount;
                    }
                }
                
                w.textMessageCount = contactTaskCount;
                // Total SMS count
                w.totalSmsMessageCount = contactTotalSmsCountMap.containsKey(w.contactId) 
                    ? contactTotalSmsCountMap.get(w.contactId) 
                    : 0;
                // Account Engagement responses
                w.accountEngagementResponseCount = contactAEResponseCountMap.containsKey(w.contactId) 
                    ? contactAEResponseCountMap.get(w.contactId) 
                    : 0;
                // Total SMS responses
                w.totalResponseCount = contactSmsResponseCountMap.containsKey(w.contactId) 
                    ? contactSmsResponseCountMap.get(w.contactId) 
                    : 0;
            }
        }
        
        // Calculate response rates and member engagement metrics
        // Account Engagement Response Rate = AE responses / AE messages sent * 100
        Integer totalAEMessagesSent = (Integer) result.get('totalAETextMessagesSent') != null 
            ? (Integer) result.get('totalAETextMessagesSent') 
            : 0;
        Integer totalAEResponsesCount = (Integer) result.get('accountEngagementResponses') != null 
            ? (Integer) result.get('accountEngagementResponses') 
            : 0;
        Decimal aeResponseRate = totalAEMessagesSent > 0 
            ? (totalAEResponsesCount * 100.0 / totalAEMessagesSent) 
            : 0;
        result.put('accountEngagementResponseRate', aeResponseRate);
        
        // Total Response Rate = total responses / total messages sent * 100
        Integer totalMessagesSent = (Integer) result.get('totalSmsMessagesSent') != null 
            ? (Integer) result.get('totalSmsMessagesSent') 
            : 0;
        Integer totalResponsesCount = (Integer) result.get('totalSmsResponses') != null 
            ? (Integer) result.get('totalSmsResponses') 
            : 0;
        Decimal totalResponseRate = totalMessagesSent > 0 
            ? (totalResponsesCount * 100.0 / totalMessagesSent) 
            : 0;
        result.put('totalResponseRate', totalResponseRate);
        
        // Count unique members who responded (any inbound SMS)
        Set<Id> membersWhoResponded = new Set<Id>();
        try {
            List<smagicinteract__smsMagic__c> allInboundSms = [
                SELECT smagicinteract__Lead__c, smagicinteract__Contact__c
                FROM smagicinteract__smsMagic__c
                WHERE smagicinteract__Direction__c = 'IN'
                AND (smagicinteract__Lead__c IN :leadIds 
                     OR smagicinteract__Contact__c IN :contactIds)
            ];
            
            for (smagicinteract__smsMagic__c sms : allInboundSms) {
                if (sms.smagicinteract__Lead__c != null) {
                    membersWhoResponded.add(sms.smagicinteract__Lead__c);
                }
                if (sms.smagicinteract__Contact__c != null) {
                    membersWhoResponded.add(sms.smagicinteract__Contact__c);
                }
            }
        } catch (Exception e) {
            System.debug('Error counting members who responded: ' + e.getMessage());
        }
        
        Integer totalMembers = (Integer) result.get('totalMembers') != null 
            ? (Integer) result.get('totalMembers') 
            : 0;
        Decimal binaryResponseRate = totalMembers > 0 
            ? (membersWhoResponded.size() * 100.0 / totalMembers) 
            : 0;
        result.put('binaryResponseRate', binaryResponseRate);
        
        // Count unique members who opted out (inbound SMS with 'STOP' or 'OPT OUT')
        Set<Id> membersOptedOut = new Set<Id>();
        try {
            List<smagicinteract__smsMagic__c> allInboundSmsForOptOut = [
                SELECT smagicinteract__Lead__c, smagicinteract__Contact__c, smagicinteract__SMSText__c
                FROM smagicinteract__smsMagic__c
                WHERE smagicinteract__Direction__c = 'IN'
                AND (smagicinteract__Lead__c IN :leadIds 
                     OR smagicinteract__Contact__c IN :contactIds)
            ];
            
            for (smagicinteract__smsMagic__c sms : allInboundSmsForOptOut) {
                String smsText = sms.smagicinteract__SMSText__c != null 
                    ? sms.smagicinteract__SMSText__c.trim().toUpperCase() 
                    : '';
                
                // Check for opt-out keywords
                if (smsText == 'STOP' || smsText == 'STOP.' || 
                    smsText.contains('STOP') || 
                    smsText.contains('OPT OUT') || 
                    smsText.contains('OPT-OUT') ||
                    smsText.contains('UNSUBSCRIBE') || 
                    smsText.contains('REMOVE') ||
                    smsText.contains('QUIT')) {
                    
                    if (sms.smagicinteract__Lead__c != null) {
                        membersOptedOut.add(sms.smagicinteract__Lead__c);
                    }
                    if (sms.smagicinteract__Contact__c != null) {
                        membersOptedOut.add(sms.smagicinteract__Contact__c);
                    }
                }
            }
        } catch (Exception e) {
            System.debug('Error counting opt-outs: ' + e.getMessage());
        }
        
        result.put('uniqueMembersOptedOut', membersOptedOut.size());
        Decimal optOutPercentage = totalMembers > 0 
            ? (membersOptedOut.size() * 100.0 / totalMembers) 
            : 0;
        result.put('optOutPercentage', optOutPercentage);
        
        System.debug(LoggingLevel.DEBUG, '=== CHART DATA CALCULATIONS START ===');
        System.debug(LoggingLevel.DEBUG, 'Total wrappers to process: ' + wrappers.size());
        System.debug(LoggingLevel.DEBUG, 'Members responded: ' + membersWhoResponded.size() + 
                     ', Members opted out: ' + membersOptedOut.size());
        
        // ===================================================================
        // CHART 9: Win Rate by Lead Source
        // ===================================================================
        System.debug(LoggingLevel.DEBUG, 'Calculating Chart 9: Win Rate by Lead Source...');
        Map<String, Map<String, Integer>> winRateBySource = new Map<String, Map<String, Integer>>();
        for (MemberWrapper m : wrappers) {
            // Use leadSource if available, otherwise use memberType as fallback
            String source = (m.leadSource != null && m.leadSource != '') ? m.leadSource : (m.memberType != null ? m.memberType : 'Unknown');
            if (!winRateBySource.containsKey(source)) {
                winRateBySource.put(source, new Map<String, Integer>{'total' => 0, 'won' => 0});
            }
            Map<String, Integer> counts = winRateBySource.get(source);
            counts.put('total', counts.get('total') + 1);
            
            if (m.opportunityStage == 'Closed Won First Payment Pending' || m.opportunityStage == 'Closed Won - First Payment Completed') {
                counts.put('won', counts.get('won') + 1);
            }
        }
        System.debug(LoggingLevel.DEBUG, 'Chart 9 result keys: ' + winRateBySource.keySet() + 
                     ', values: ' + winRateBySource.values());
        result.put('winRateBySource', winRateBySource);
        
        // ===================================================================
        // CHART 10: Cumulative Opportunities Over Time
        // ===================================================================
        System.debug(LoggingLevel.DEBUG, 'Calculating Chart 10: Cumulative Opportunities...');
        System.debug(LoggingLevel.DEBUG, 'allOppIds count: ' + allOppIds.size());
        Map<String, Integer> cumulativeAllOppMap = new Map<String, Integer>();
        Map<String, Integer> cumulativeClosedWonMap = new Map<String, Integer>();
        Integer cumulativeAllCount = 0;
        Integer cumulativeWonCount = 0;
        
        List<Opportunity> oppsByDate = [
            SELECT Id, CreatedDate, StageName
            FROM Opportunity 
            WHERE Id IN :allOppIds 
            ORDER BY CreatedDate ASC
        ];
        System.debug(LoggingLevel.DEBUG, 'Retrieved ' + oppsByDate.size() + ' opportunities by date');
        
        for (Opportunity opp : oppsByDate) {
            String dateStr = opp.CreatedDate.format('yyyy-MM-dd');
            
            // Increment cumulative all opportunities
            cumulativeAllCount++;
            cumulativeAllOppMap.put(dateStr, cumulativeAllCount);
            
            // Check if closed won and increment cumulative closed won
            Boolean isClosedWon = opp.StageName == 'Closed Won First Payment Pending' || 
                                  opp.StageName == 'Closed Won - First Payment Completed';
            if (isClosedWon) {
                cumulativeWonCount++;
            }
            cumulativeClosedWonMap.put(dateStr, cumulativeWonCount);
        }
        System.debug(LoggingLevel.DEBUG, 'Chart 10 cumulative all map size: ' + cumulativeAllOppMap.size() + 
                     ', final cumulative all count: ' + cumulativeAllCount);
        System.debug(LoggingLevel.DEBUG, 'Chart 10 cumulative won map size: ' + cumulativeClosedWonMap.size() + 
                     ', final cumulative won count: ' + cumulativeWonCount);
        
        // Update result map with actual cumulative opportunity counts
        // These replace the Campaign.NumberOfOpportunities values which may be out of sync
        result.put('totalOpportunities', cumulativeAllCount);
        result.put('closedWonOpportunities', cumulativeWonCount);
        
        // Calculate win rate based on cumulative values
        Decimal campaignWinRatePercentage = cumulativeAllCount > 0 ? (cumulativeWonCount * 100.0 / cumulativeAllCount) : 0;
        result.put('campaignWinRate', campaignWinRatePercentage);
        
        System.debug(LoggingLevel.DEBUG, 'Updated totalOpportunities to: ' + cumulativeAllCount + 
                     ', closedWonOpportunities to: ' + cumulativeWonCount + 
                     ', campaignWinRate to: ' + campaignWinRatePercentage + '%');
        
        // Return both datasets in a map for the chart to display
        Map<String, Map<String, Integer>> cumulativeOppData = new Map<String, Map<String, Integer>>();
        cumulativeOppData.put('allOpportunities', cumulativeAllOppMap);
        cumulativeOppData.put('closedWon', cumulativeClosedWonMap);
        result.put('cumulativeClosedWon', cumulativeOppData);
        
        // ===================================================================
        // CHART 11: Campaign Velocity Analysis (Days from lead generation to closed won)
        // ===================================================================
        // Calculate days between CampaignMember creation and when opportunities reached closed won stages
        Map<String, List<Integer>> velocityDaysMap = new Map<String, List<Integer>>();
        List<Integer> allVelocityDays = new List<Integer>();
        
        // Build a map of campaign member IDs to their creation dates for velocity calculation
        Map<Id, DateTime> cmemberCreatedDateMap = new Map<Id, DateTime>();
        for (CampaignMember cm : members) {
            cmemberCreatedDateMap.put(cm.Id, cm.CreatedDate);
        }
        
        // Query opportunities to find their stage change dates or use CloseDate for closed won
        for (Opportunity opp : [
            SELECT Id, StageName, CloseDate 
            FROM Opportunity 
            WHERE Id IN :allOppIds 
            AND (StageName = 'Closed Won First Payment Pending' OR StageName = 'Closed Won - First Payment Completed')
        ]) {
            // Find the campaign member associated with this opportunity
            // We need to iterate through our member wrappers to match
            DateTime cmemberCreatedDate = null;
            
            for (MemberWrapper w : wrappers) {
                if (w.opportunityId == opp.Id) {
                    // Calculate the lead creation date - use contact/lead creation as proxy for campaign member entry
                    if (w.memberType == 'Contact') {
                        // For contacts, we'd need to query the contact creation date
                        // But we have the member wrapper with the campaign member relationship
                        cmemberCreatedDate = cmemberCreatedDateMap.get(w.memberId);
                    } else if (w.memberType == 'Lead') {
                        // For leads, use the campaign member creation date
                        cmemberCreatedDate = cmemberCreatedDateMap.get(w.memberId);
                    }
                    break;
                }
            }
            
            // Calculate days between campaign member creation and opportunity close date
            if (cmemberCreatedDate != null && opp.CloseDate != null) {
                Date cmemberCreatedDateOnly = cmemberCreatedDate.date();
                Date closeDateOnly = opp.CloseDate;
                Integer daysDiff = (Integer) closeDateOnly.daysBetween(cmemberCreatedDateOnly);
                if (daysDiff < 0) daysDiff = Math.abs(daysDiff);
                
                allVelocityDays.add(daysDiff);
                
                String stage = opp.StageName != null ? opp.StageName : 'Unknown';
                if (!velocityDaysMap.containsKey(stage)) {
                    velocityDaysMap.put(stage, new List<Integer>());
                }
                velocityDaysMap.get(stage).add(daysDiff);
            }
        }
        result.put('velocityDaysDistribution', allVelocityDays);
        
        // ===================================================================
        // CHART 12: SMS Messages vs Opportunities Created (Weekly correlation)
        // ===================================================================
        Map<String, Integer> weeklySmsMap = new Map<String, Integer>();
        Map<String, Integer> weeklyOppMap = new Map<String, Integer>();
        
        // Count SMS by week
        if (textMessagesByDateMap != null) {
            for (String dateStr : textMessagesByDateMap.keySet()) {
                String weekKey = dateStr.substring(0, 7); // yyyy-MM for grouping by month
                Integer current = weeklySmsMap.containsKey(weekKey) ? weeklySmsMap.get(weekKey) : 0;
                weeklySmsMap.put(weekKey, current + textMessagesByDateMap.get(dateStr));
            }
        }
        
        // Count opportunities by week
        for (Opportunity opp : [SELECT CreatedDate FROM Opportunity WHERE Id IN :allOppIds]) {
            String weekKey = opp.CreatedDate.format('yyyy-MM');
            Integer current = weeklyOppMap.containsKey(weekKey) ? weeklyOppMap.get(weekKey) : 0;
            weeklyOppMap.put(weekKey, current + 1);
        }
        
        Map<String, Map<String, Integer>> weeklySmsVsOpps = new Map<String, Map<String, Integer>>();
        Set<String> allWeeks = new Set<String>();
        allWeeks.addAll(weeklySmsMap.keySet());
        allWeeks.addAll(weeklyOppMap.keySet());
        
        for (String week : allWeeks) {
            Map<String, Integer> weekData = new Map<String, Integer>();
            weekData.put('sms', weeklySmsMap.containsKey(week) ? weeklySmsMap.get(week) : 0);
            weekData.put('opps', weeklyOppMap.containsKey(week) ? weeklyOppMap.get(week) : 0);
            weeklySmsVsOpps.put(week, weekData);
        }
        result.put('weeklySmsVsOpps', weeklySmsVsOpps);
        
        // ===================================================================
        // CHART 13: Engagement Distribution (Messages per Member)
        // ===================================================================
        Map<Integer, Integer> engagementDistribution = new Map<Integer, Integer>();
        for (MemberWrapper m : wrappers) {
            Integer messageCount = m.textMessageCount != null ? m.textMessageCount : 0;
            Integer bucket = messageCount / 10; // Group by 10s: 0-9, 10-19, 20-29, etc.
            Integer current = engagementDistribution.containsKey(bucket) ? engagementDistribution.get(bucket) : 0;
            engagementDistribution.put(bucket, current + 1);
        }
        result.put('engagementDistribution', engagementDistribution);
        
        // ===================================================================
        // CHART 14: Response Rate by Lead Source
        // ===================================================================
        Map<String, Map<String, Decimal>> responseRateBySource = new Map<String, Map<String, Decimal>>();
        for (MemberWrapper m : wrappers) {
            String source = (m.leadSource != null && m.leadSource != '') ? m.leadSource : (m.memberType != null ? m.memberType : 'Unknown');
            if (!responseRateBySource.containsKey(source)) {
                responseRateBySource.put(source, new Map<String, Decimal>{'sent' => 0, 'responded' => 0});
            }
            Map<String, Decimal> counts = responseRateBySource.get(source);
            counts.put('sent', counts.get('sent') + (m.totalSmsMessageCount != null ? m.totalSmsMessageCount : 0));
            counts.put('responded', counts.get('responded') + (m.totalResponseCount != null ? m.totalResponseCount : 0));
        }
        result.put('responseRateBySource', responseRateBySource);
        
        // ===================================================================
        // CHART 14B: Response Rate by Message Type (Account Engagement vs Total SMS)
        // ===================================================================
        Map<String, Map<String, Decimal>> responseByType = new Map<String, Map<String, Decimal>>();
        
        // Calculate Account Engagement response rate
        Integer aeCount = 0, aeResponses = 0;
        Integer totalSmsCount = 0, totalSmsResponses = 0;
        
        for (MemberWrapper m : wrappers) {
            // Account Engagement: textMessageCount is the sent count
            aeCount += (m.textMessageCount != null ? m.textMessageCount : 0);
            aeResponses += (m.accountEngagementResponseCount != null ? m.accountEngagementResponseCount : 0);
            
            // Total SMS from all sources
            totalSmsCount += (m.totalSmsMessageCount != null ? m.totalSmsMessageCount : 0);
            totalSmsResponses += (m.totalResponseCount != null ? m.totalResponseCount : 0);
        }
        
        Decimal aeRate = aeCount > 0 ? (aeResponses * 100.0) / aeCount : 0;
        Decimal totalSmsRate = totalSmsCount > 0 ? (totalSmsResponses * 100.0) / totalSmsCount : 0;
        
        responseByType.put('Account Engagement', new Map<String, Decimal>{'rate' => aeRate});
        responseByType.put('All SMS Messages', new Map<String, Decimal>{'rate' => totalSmsRate});
        result.put('responseByType', responseByType);
        
        // ===================================================================
        // CHART 15: Member Response Cohorts (Engagement Levels)
        // ===================================================================
        Map<String, Integer> responseCohorts = new Map<String, Integer>{
            'Non-Responders (0%)' => 0,
            'Low (1-25%)' => 0,
            'Medium (26-50%)' => 0,
            'High (51-75%)' => 0,
            'Very High (76%+)' => 0
        };
        
        for (MemberWrapper m : wrappers) {
            if (m.textMessageCount == 0 || m.textMessageCount == null) {
                responseCohorts.put('Non-Responders (0%)', responseCohorts.get('Non-Responders (0%)') + 1);
            } else {
                Decimal rate = (Decimal) m.accountEngagementResponseCount / m.textMessageCount * 100;
                if (rate <= 25) {
                    responseCohorts.put('Low (1-25%)', responseCohorts.get('Low (1-25%)') + 1);
                } else if (rate <= 50) {
                    responseCohorts.put('Medium (26-50%)', responseCohorts.get('Medium (26-50%)') + 1);
                } else if (rate <= 75) {
                    responseCohorts.put('High (51-75%)', responseCohorts.get('High (51-75%)') + 1);
                } else {
                    responseCohorts.put('Very High (76%+)', responseCohorts.get('Very High (76%+)') + 1);
                }
            }
        }
        result.put('responseCohorts', responseCohorts);
        
        // ===================================================================
        // CHART 16: Opt-Out Trend Analysis (by date)
        // ===================================================================
        Map<String, Integer> optOutByDateMap = new Map<String, Integer>();
        try {
            // Query all inbound SMS - we'll filter by text content in Apex
            List<smagicinteract__smsMagic__c> allInboundSMS = [
                SELECT CreatedDate
                FROM smagicinteract__smsMagic__c
                WHERE smagicinteract__Direction__c = 'Inbound'
                ORDER BY CreatedDate ASC
                LIMIT 10000
            ];
            
            Integer cumulativeOptOuts = 0;
            for (smagicinteract__smsMagic__c sms : allInboundSMS) {
                // Note: smagicinteract__SMSText__c cannot be queried, so we count all inbound for now
                // In a real scenario, you'd need to use a reporting feature or external log
                String dateStr = sms.CreatedDate.format('yyyy-MM-dd');
                cumulativeOptOuts++;
                optOutByDateMap.put(dateStr, cumulativeOptOuts);
            }
        } catch (Exception e) {
            System.debug('Error calculating opt-out trend: ' + e.getMessage());
        }
        result.put('optOutTrendByDate', optOutByDateMap);
        
        System.debug(LoggingLevel.DEBUG, '=== FINAL RESULT MAP COMPILATION ===');
        System.debug(LoggingLevel.DEBUG, 'Result map keys: ' + result.keySet());
        System.debug(LoggingLevel.DEBUG, 'Members array size: ' + ((List<MemberWrapper>) result.get('members')).size());
        
        // Log summary statistics
        System.debug(LoggingLevel.DEBUG, 'Totals: ' +
                     'totalMembers=' + result.get('totalMembers') + 
                     ', totalLeads=' + result.get('totalLeads') + 
                     ', totalContacts=' + result.get('totalContacts') + 
                     ', totalAETextMessagesSent=' + result.get('totalAETextMessagesSent') + 
                     ', accountEngagementResponses=' + result.get('accountEngagementResponses') + 
                     ', totalSmsMessagesSent=' + result.get('totalSmsMessagesSent') + 
                     ', totalSmsResponses=' + result.get('totalSmsResponses'));
        
        // Log chart data availability
        Object winRateBySourceChart = result.get('winRateBySource');
        Object cumOpp = result.get('cumulativeClosedWon');
        Object velocity = result.get('velocityByStage');
        Object weeklySms = result.get('weeklySmsVsOpps');
        Object engagement = result.get('engagementDistribution');
        Object respBySource = result.get('responseRateBySource');
        Object cohorts = result.get('responseCohorts');
        Object optTrend = result.get('optOutTrendByDate');
        Object heatmapData = result.get('messageHeatmap');
        
        System.debug(LoggingLevel.DEBUG, 'Chart data availability: ' +
                     'winRateBySource=' + (winRateBySourceChart != null) + 
                     ', cumulativeClosedWon=' + (cumOpp != null) + 
                     ', velocityByStage=' + (velocity != null) + 
                     ', weeklySmsVsOpps=' + (weeklySms != null) + 
                     ', engagementDistribution=' + (engagement != null) + 
                     ', responseRateBySource=' + (respBySource != null) + 
                     ', responseCohorts=' + (cohorts != null) + 
                     ', optOutTrendByDate=' + (optTrend != null) +
                     ', messageHeatmap=' + (heatmapData != null));
        
        // ===== FINAL DEBUG: COMPREHENSIVE DISCREPANCY SUMMARY =====
        System.debug(LoggingLevel.DEBUG, '');
        System.debug(LoggingLevel.DEBUG, '===== COMPREHENSIVE DISCREPANCY SUMMARY =====');
        System.debug(LoggingLevel.DEBUG, 'Campaign Name: ' + campaign.Name);
        System.debug(LoggingLevel.DEBUG, '');
        System.debug(LoggingLevel.DEBUG, 'CAMPAIGN MEMBER COUNTS (from CampaignMember table):');
        System.debug(LoggingLevel.DEBUG, '  Total CampaignMembers: ' + members.size());
        System.debug(LoggingLevel.DEBUG, '  - Lead only: ' + leadMemberCount);
        System.debug(LoggingLevel.DEBUG, '  - Contact only: ' + contactMemberCount);
        System.debug(LoggingLevel.DEBUG, '  - Both Lead & Contact: ' + bothLeadAndContactCount);
        System.debug(LoggingLevel.DEBUG, '  - Neither (orphaned): ' + neitherCount);
        System.debug(LoggingLevel.DEBUG, '');
        System.debug(LoggingLevel.DEBUG, 'CAMPAIGN ROLLUP FIELDS (from Campaign object):');
        System.debug(LoggingLevel.DEBUG, '  NumberOfLeads: ' + campaign.NumberOfLeads);
        System.debug(LoggingLevel.DEBUG, '  NumberOfContacts: ' + campaign.NumberOfContacts);
        System.debug(LoggingLevel.DEBUG, '  NumberOfConvertedLeads: ' + campaign.NumberOfConvertedLeads);
        System.debug(LoggingLevel.DEBUG, '  NumberOfOpportunities: ' + campaign.NumberOfOpportunities);
        System.debug(LoggingLevel.DEBUG, '');
        System.debug(LoggingLevel.DEBUG, 'CALCULATED COUNTS (from wrapper processing):');
        System.debug(LoggingLevel.DEBUG, '  Total unique opportunities: ' + allOppIds.size());
        System.debug(LoggingLevel.DEBUG, '  Closed Won opportunities (calculated): ' + wonCount);
        System.debug(LoggingLevel.DEBUG, '  Total converted leads: ' + convertedLeads);
        System.debug(LoggingLevel.DEBUG, '  Total unconverted leads: ' + unconvertedLeads);
        System.debug(LoggingLevel.DEBUG, '');
        System.debug(LoggingLevel.DEBUG, 'KEY FINDINGS:');
        System.debug(LoggingLevel.DEBUG, '  Members vs Campaign (Leads+Contacts): ' + members.size() + ' vs ' + (campaign.NumberOfLeads + campaign.NumberOfContacts) + ' = ' + (members.size() - (campaign.NumberOfLeads + campaign.NumberOfContacts)) + ' discrepancy');
        System.debug(LoggingLevel.DEBUG, '  Lead status distribution: ' + leadStatusCounts);
        System.debug(LoggingLevel.DEBUG, '  Opportunity stages: ' + oppStageCounts);
        System.debug(LoggingLevel.DEBUG, '');
        System.debug(LoggingLevel.DEBUG, 'POSSIBLE CAUSES:');
        if (bothLeadAndContactCount > 0) {
            System.debug(LoggingLevel.DEBUG, '  ✓ Found ' + bothLeadAndContactCount + ' members with BOTH Lead and Contact IDs (converted leads)');
        }
        if (neitherCount > 0) {
            System.debug(LoggingLevel.DEBUG, '  ✗ Found ' + neitherCount + ' orphaned members (neither Lead nor Contact)');
        }
        if (members.size() > (campaign.NumberOfLeads + campaign.NumberOfContacts)) {
            System.debug(LoggingLevel.DEBUG, '  ⚠ More members (' + members.size() + ') than campaign reports (' + (campaign.NumberOfLeads + campaign.NumberOfContacts) + ')');
        }
        System.debug(LoggingLevel.DEBUG, '');
        
        Long endTime = System.currentTimeMillis();
        Long duration = endTime - startTime;
        System.debug(LoggingLevel.DEBUG, '=== CampaignJourneyController.getJourneyData COMPLETE in ' + duration + 'ms ===');

        return result;
    }

    /**
     * Helper method to build MemberWrapper objects from CampaignMembers
     * Populates wrapper fields based on Lead or Contact data and opportunity linkage
     * 
     * @param members List of CampaignMember records to process
     * @param contactOppMap Map of Contact IDs to their linked Opportunities
     * @param convertedOppMap Map of Lead IDs to their converted Opportunities
     * @param leadIncomingCallCountMap Map of Lead IDs to incoming call counts
     * @param allOppIds Set to accumulate all Opportunity IDs (populated by this method)
     * @param closedWonBySourceMap Map to accumulate closed won counts by source (populated by this method)
     * @return List<MemberWrapper> populated member wrapper objects
     */
    @TestVisible
    private static List<MemberWrapper> buildMemberWrappers(
        List<CampaignMember> members,
        Map<Id, Opportunity> contactOppMap,
        Map<Id, Opportunity> convertedOppMap,
        Map<Id, Integer> leadIncomingCallCountMap,
        Set<Id> allOppIds,
        Map<String, Integer> closedWonBySourceMap
    ) {
        List<MemberWrapper> wrappers = new List<MemberWrapper>();
        
        for (CampaignMember cm : members) {
            MemberWrapper w = new MemberWrapper();
            w.memberId = cm.Id;
            w.status = cm.Status;

            Opportunity linkedOpp = null;

            if (cm.ContactId != null) {
                w.memberType = 'Contact';
                w.contactId = cm.ContactId;
                w.leadId = null;
                w.name = cm.Contact.Name;
                w.email = cm.Contact.Email;
                w.leadStatus = null;
                w.isConverted = null;
                w.convertedTo = null;
                w.incomingCallCount = 0;
                linkedOpp = contactOppMap.get(cm.ContactId);
                w.leadSource = (linkedOpp != null && linkedOpp.LeadSource != null) ? linkedOpp.LeadSource : null;
            } else if (cm.LeadId != null) {
                w.memberType = 'Lead';
                w.leadId = cm.LeadId;
                w.contactId = null;
                w.name = cm.Lead.Name;
                w.email = cm.Lead.Email;
                w.leadStatus = cm.Lead.Status;
                w.leadSource = cm.Lead.LeadSource;
                w.isConverted = cm.Lead.IsConverted;
                w.incomingCallCount = leadIncomingCallCountMap.containsKey(cm.LeadId) 
                    ? leadIncomingCallCountMap.get(cm.LeadId) 
                    : 0;

                if (cm.Lead.IsConverted) {
                    w.convertedTo = 'Contact & Opportunity';
                    if (cm.Lead.ConvertedContactId != null) {
                        linkedOpp = contactOppMap.get(cm.Lead.ConvertedContactId);
                    }
                    if (linkedOpp == null) {
                        linkedOpp = convertedOppMap.get(cm.Lead.Id);
                    }
                    if (w.leadSource == null && linkedOpp != null && linkedOpp.LeadSource != null) {
                        w.leadSource = linkedOpp.LeadSource;
                    }
                } else {
                    w.convertedTo = null;
                }
            }

            if (linkedOpp != null) {
                w.opportunityId = linkedOpp.Id;
                w.opportunityName = linkedOpp.Name;
                w.opportunityStage = linkedOpp.StageName;
                w.opportunityAmount = linkedOpp.Amount;
                w.currentDebt = linkedOpp.Current_Total_Debt__c;
                allOppIds.add(linkedOpp.Id);
                
                Boolean isClosedWon = linkedOpp.StageName == 'Closed Won First Payment Pending' || 
                                      linkedOpp.StageName == 'Closed Won - First Payment Completed';
                
                if (isClosedWon) {
                    if (w.leadSource != null) {
                        closedWonBySourceMap.put(
                            w.leadSource,
                            closedWonBySourceMap.containsKey(w.leadSource) ? closedWonBySourceMap.get(w.leadSource) + 1 : 1
                        );
                    }
                }
            }

            wrappers.add(w);
        }
        
        return wrappers;
    }

    /**
     * Helper method to build maps of outbound SMS records by Lead and Contact
     * Groups outbound SMS messages by their recipient for response matching
     * 
     * @param aeOutboundSms List of outbound SMS records
     * @param leadOutboundAeMap Map to populate with Lead ID -> List of SMS records (populated by this method)
     * @param contactOutboundAeMap Map to populate with Contact ID -> List of SMS records (populated by this method)
     */
    @TestVisible
    private static void buildOutboundSmsMap(
        List<smagicinteract__smsMagic__c> aeOutboundSms,
        Map<Id, List<smagicinteract__smsMagic__c>> leadOutboundAeMap,
        Map<Id, List<smagicinteract__smsMagic__c>> contactOutboundAeMap
    ) {
        for (smagicinteract__smsMagic__c outbound : aeOutboundSms) {
            if (outbound.smagicinteract__Lead__c != null) {
                if (!leadOutboundAeMap.containsKey(outbound.smagicinteract__Lead__c)) {
                    leadOutboundAeMap.put(outbound.smagicinteract__Lead__c, new List<smagicinteract__smsMagic__c>());
                }
                leadOutboundAeMap.get(outbound.smagicinteract__Lead__c).add(outbound);
            }
            if (outbound.smagicinteract__Contact__c != null) {
                if (!contactOutboundAeMap.containsKey(outbound.smagicinteract__Contact__c)) {
                    contactOutboundAeMap.put(outbound.smagicinteract__Contact__c, new List<smagicinteract__smsMagic__c>());
                }
                contactOutboundAeMap.get(outbound.smagicinteract__Contact__c).add(outbound);
            }
        }
    }

    /**
     * Helper method to serialize heatmap data for AuraEnabled return
     * Converts Map<String, Map<String, Integer>> to Map<String, Map<String, Object>> for serialization
     * 
     * @param heatmapByDayHour Map of day of week to hour to count
     * @return Map<String, Object> serialized heatmap data
     */
    @TestVisible
    private static Map<String, Object> serializeHeatmapData(Map<String, Map<String, Integer>> heatmapByDayHour) {
        Map<String, Object> heatmapSerialized = new Map<String, Object>();
        for (String day : heatmapByDayHour.keySet()) {
            Map<String, Integer> hourMap = heatmapByDayHour.get(day);
            Map<String, Object> hourMapObj = new Map<String, Object>();
            for (String hour : hourMap.keySet()) {
                hourMapObj.put(hour, hourMap.get(hour));
            }
            heatmapSerialized.put(day, hourMapObj);
        }
        
        System.debug(LoggingLevel.DEBUG, '[messageHeatmap] Final Size: ' + heatmapByDayHour.size() + ' days');
        if (heatmapByDayHour.size() > 0) {
            Integer totalHeatmapMessages = 0;
            for (String day : heatmapByDayHour.keySet()) {
                Map<String, Integer> dayHours = heatmapByDayHour.get(day);
                Integer dayTotal = 0;
                for (Integer count : dayHours.values()) {
                    dayTotal += count;
                }
                totalHeatmapMessages += dayTotal;
                System.debug(LoggingLevel.DEBUG, '[messageHeatmap] ' + day + ': ' + dayHours.size() + ' hours, ' + dayTotal + ' messages');
            }
            System.debug(LoggingLevel.DEBUG, '[messageHeatmap] TOTAL messages in heatmap: ' + totalHeatmapMessages);
        } else {
            System.debug(LoggingLevel.DEBUG, '[messageHeatmap] Heatmap is empty - no SMS data available');
        }
        
        return heatmapSerialized;
    }

    /**
     * Helper method to process outbound SMS Magic records and populate aggregation maps
     * Calculates text message counts by Lead, Contact, action type, date, and heatmap data
     * 
     * @param aeOutboundSms List of outbound SMS records to process
     * @param actionIdToNameMap Map of Converse App Action IDs to their names
     * @param leadTextMessageCountMap Map to store SMS count by Lead ID (populated by this method)
     * @param contactTextMessageCountMap Map to store SMS count by Contact ID (populated by this method)
     * @param textMessagesByActionTypeMap Map to store SMS count by action type (populated by this method)
     * @param textMessagesByDateMap Map to store SMS count by date (populated by this method)
     * @param textMessagesByDateAndActionMap Map to store SMS count by date and action (populated by this method)
     * @param heatmapByDayHour Map to store heatmap data by day and hour (populated by this method)
     * @param aeMemberLeadIds Set of Lead IDs that received SMS (populated by this method)
     * @param aeMemberContactIds Set of Contact IDs that received SMS (populated by this method)
     */
    @TestVisible
    private static void processOutboundSmsMagicRecords(
        List<smagicinteract__smsMagic__c> aeOutboundSms,
        Map<Id, String> actionIdToNameMap,
        Map<Id, Integer> leadTextMessageCountMap,
        Map<Id, Integer> contactTextMessageCountMap,
        Map<String, Integer> textMessagesByActionTypeMap,
        Map<String, Integer> textMessagesByDateMap,
        Map<String, Map<String, Integer>> textMessagesByDateAndActionMap,
        Map<String, Map<String, Integer>> heatmapByDayHour,
        Set<Id> aeMemberLeadIds,
        Set<Id> aeMemberContactIds
    ) {
        for (smagicinteract__smsMagic__c sms : aeOutboundSms) {
            // Track which members are part of AE
            if (sms.smagicinteract__Lead__c != null) {
                aeMemberLeadIds.add(sms.smagicinteract__Lead__c);
                
                // Count text messages by Lead
                Id leadId = sms.smagicinteract__Lead__c;
                leadTextMessageCountMap.put(
                    leadId,
                    leadTextMessageCountMap.containsKey(leadId) 
                        ? leadTextMessageCountMap.get(leadId) + 1 
                        : 1
                );
            }
            
            if (sms.smagicinteract__Contact__c != null) {
                aeMemberContactIds.add(sms.smagicinteract__Contact__c);
                
                // Count text messages by Contact
                Id contactId = sms.smagicinteract__Contact__c;
                contactTextMessageCountMap.put(
                    contactId,
                    contactTextMessageCountMap.containsKey(contactId) 
                        ? contactTextMessageCountMap.get(contactId) + 1 
                        : 1
                );
            }
            
            // Count text messages by action type
            if (sms.smagicinteract__Converse_App_Action__c != null) {
                String actionName = actionIdToNameMap.get(sms.smagicinteract__Converse_App_Action__c);
                if (actionName == null) {
                    actionName = 'Unknown Action';
                }
                textMessagesByActionTypeMap.put(
                    actionName,
                    textMessagesByActionTypeMap.containsKey(actionName) 
                        ? textMessagesByActionTypeMap.get(actionName) + 1 
                        : 1
                );
            }
            
            // Count text messages by date for overall graph
            if (sms.CreatedDate != null) {
                String dateStr = String.valueOf(sms.CreatedDate.date());
                textMessagesByDateMap.put(
                    dateStr,
                    textMessagesByDateMap.containsKey(dateStr) ? textMessagesByDateMap.get(dateStr) + 1 : 1
                );
                
                // Count text messages by date and action type for stacked chart
                if (sms.smagicinteract__Converse_App_Action__c != null) {
                    String actionName = actionIdToNameMap.get(sms.smagicinteract__Converse_App_Action__c);
                    if (actionName == null) {
                        actionName = 'Unknown Action';
                    }
                    
                    if (!textMessagesByDateAndActionMap.containsKey(dateStr)) {
                        textMessagesByDateAndActionMap.put(dateStr, new Map<String, Integer>());
                    }
                    Map<String, Integer> actionCountsByDate = textMessagesByDateAndActionMap.get(dateStr);
                    actionCountsByDate.put(
                        actionName,
                        actionCountsByDate.containsKey(actionName) ? actionCountsByDate.get(actionName) + 1 : 1
                    );
                }
                
                // Build message heatmap by hour and day of week
                Integer hourOfDay = sms.CreatedDate.hour();
                String dayOfWeekStr = sms.CreatedDate.format('EEEE');
                
                if (!heatmapByDayHour.containsKey(dayOfWeekStr)) {
                    heatmapByDayHour.put(dayOfWeekStr, new Map<String, Integer>());
                    System.debug(LoggingLevel.DEBUG, '[heatmap] Created entry for day: ' + dayOfWeekStr);
                }
                Map<String, Integer> hourCounts = heatmapByDayHour.get(dayOfWeekStr);
                String hourKey = String.valueOf(hourOfDay);
                hourCounts.put(
                    hourKey,
                    hourCounts.containsKey(hourKey) ? hourCounts.get(hourKey) + 1 : 1
                );
            }
        }
    }

    /**
     * Analyzes and logs campaign member breakdown details
     */
    @TestVisible
    private static void analyzeCampaignMemberBreakdown(List<CampaignMember> members, Campaign campaign) {
        Integer leadMemberCount = 0;
        Integer contactMemberCount = 0;
        Integer bothLeadAndContactCount = 0;
        Integer neitherCount = 0;
        Map<String, Integer> leadStatusCounts = new Map<String, Integer>();
        Map<String, Integer> memberStatusCounts = new Map<String, Integer>();
        
        for (CampaignMember cm : members) {
            if (cm.LeadId != null && cm.ContactId != null) {
                bothLeadAndContactCount++;
            } else if (cm.LeadId != null) {
                leadMemberCount++;
            } else if (cm.ContactId != null) {
                contactMemberCount++;
            } else {
                neitherCount++;
            }
            
            if (cm.LeadId != null && cm.Lead.Status != null) {
                String status = cm.Lead.Status;
                leadStatusCounts.put(status, (leadStatusCounts.containsKey(status) ? leadStatusCounts.get(status) : 0) + 1);
            }
            
            String cmStatus = cm.Status != null ? cm.Status : 'NULL';
            memberStatusCounts.put(cmStatus, (memberStatusCounts.containsKey(cmStatus) ? memberStatusCounts.get(cmStatus) : 0) + 1);
        }
        
        System.debug(LoggingLevel.DEBUG, '===== CAMPAIGN MEMBER BREAKDOWN =====');
        System.debug(LoggingLevel.DEBUG, 'Total CampaignMembers: ' + members.size());
        System.debug(LoggingLevel.DEBUG, '  - Lead only: ' + leadMemberCount);
        System.debug(LoggingLevel.DEBUG, '  - Contact only: ' + contactMemberCount);
        System.debug(LoggingLevel.DEBUG, '  - Both Lead & Contact: ' + bothLeadAndContactCount);
        System.debug(LoggingLevel.DEBUG, '  - Neither (orphaned): ' + neitherCount);
        System.debug(LoggingLevel.DEBUG, '  - TOTAL: ' + (leadMemberCount + contactMemberCount + bothLeadAndContactCount + neitherCount));
        System.debug(LoggingLevel.DEBUG, '');
        System.debug(LoggingLevel.DEBUG, 'Lead Status Distribution:');
        for (String status : leadStatusCounts.keySet()) {
            System.debug(LoggingLevel.DEBUG, '  - ' + status + ': ' + leadStatusCounts.get(status));
        }
        System.debug(LoggingLevel.DEBUG, '');
        System.debug(LoggingLevel.DEBUG, 'CampaignMember Status Distribution:');
        for (String status : memberStatusCounts.keySet()) {
            System.debug(LoggingLevel.DEBUG, '  - ' + status + ': ' + memberStatusCounts.get(status));
        }
        System.debug(LoggingLevel.DEBUG, '');
        System.debug(LoggingLevel.DEBUG, '===== CAMPAIGN OBJECT ROLLUP FIELDS =====');
        System.debug(LoggingLevel.DEBUG, 'Campaign.NumberOfLeads: ' + campaign.NumberOfLeads);
        System.debug(LoggingLevel.DEBUG, 'Campaign.NumberOfContacts: ' + campaign.NumberOfContacts);
        System.debug(LoggingLevel.DEBUG, 'Campaign.NumberOfConvertedLeads: ' + campaign.NumberOfConvertedLeads);
        System.debug(LoggingLevel.DEBUG, 'Campaign.NumberOfOpportunities: ' + campaign.NumberOfOpportunities);
        System.debug(LoggingLevel.DEBUG, '');
        System.debug(LoggingLevel.DEBUG, '===== DISCREPANCY ANALYSIS =====');
        System.debug(LoggingLevel.DEBUG, 'Campaign (Leads + Contacts): ' + (campaign.NumberOfLeads + campaign.NumberOfContacts));
        System.debug(LoggingLevel.DEBUG, 'Total Members: ' + members.size());
        System.debug(LoggingLevel.DEBUG, 'Difference: ' + (members.size() - (campaign.NumberOfLeads + campaign.NumberOfContacts)));
        System.debug(LoggingLevel.DEBUG, '');
    }

    /**
     * Collects and returns Lead, Contact, and Converted Contact IDs from campaign members
     */
    @TestVisible
    private static Map<String, Object> collectCampaignMemberIds(List<CampaignMember> members) {
        Set<Id> contactIds = new Set<Id>();
        Set<Id> leadIds = new Set<Id>();
        Set<Id> convertedContactIds = new Set<Id>();
        
        for (CampaignMember cm : members) {
            if (cm.ContactId != null) {
                contactIds.add(cm.ContactId);
            }
            if (cm.LeadId != null) {
                leadIds.add(cm.LeadId);
                if (cm.Lead.IsConverted && cm.Lead.ConvertedContactId != null) {
                    convertedContactIds.add(cm.Lead.ConvertedContactId);
                }
            }
        }
        
        return new Map<String, Object>{
            'contactIds' => contactIds,
            'leadIds' => leadIds,
            'convertedContactIds' => convertedContactIds
        };
    }

    /**
     * Matches inbound SMS responses to outbound messages within 24-hour window
     */
    @TestVisible
    private static void matchAEResponsesToOutbound(
        List<smagicinteract__smsMagic__c> aeResponses,
        Map<Id, List<smagicinteract__smsMagic__c>> leadOutboundAeMap,
        Map<Id, List<smagicinteract__smsMagic__c>> contactOutboundAeMap,
        Map<Id, Integer> leadAEResponseCountMap,
        Map<Id, Integer> contactAEResponseCountMap,
        Map<Id, String> actionIdToNameMap,
        Map<String, Integer> aeMessageResponsesMap
    ) {
        for (smagicinteract__smsMagic__c response : aeResponses) {
            if (response.smagicinteract__Lead__c != null) {
                Id leadId = response.smagicinteract__Lead__c;
                leadAEResponseCountMap.put(
                    leadId,
                    leadAEResponseCountMap.containsKey(leadId) ? leadAEResponseCountMap.get(leadId) + 1 : 1
                );
                
                if (leadOutboundAeMap.containsKey(leadId)) {
                    matchResponseToOutbound(response, leadOutboundAeMap.get(leadId), actionIdToNameMap, aeMessageResponsesMap);
                }
            }
            if (response.smagicinteract__Contact__c != null) {
                Id contactId = response.smagicinteract__Contact__c;
                contactAEResponseCountMap.put(
                    contactId,
                    contactAEResponseCountMap.containsKey(contactId) ? contactAEResponseCountMap.get(contactId) + 1 : 1
                );
                
                if (contactOutboundAeMap.containsKey(contactId)) {
                    matchResponseToOutbound(response, contactOutboundAeMap.get(contactId), actionIdToNameMap, aeMessageResponsesMap);
                }
            }
        }
    }

    /**
     * Matches a single inbound SMS response to recent outbound messages (within 24 hours)
     */
    @TestVisible
    private static void matchResponseToOutbound(
        smagicinteract__smsMagic__c response,
        List<smagicinteract__smsMagic__c> recentOutbound,
        Map<Id, String> actionIdToNameMap,
        Map<String, Integer> aeMessageResponsesMap
    ) {
        for (smagicinteract__smsMagic__c outbound : recentOutbound) {
            if (outbound.CreatedDate != null && response.CreatedDate != null) {
                Long timeDiffMinutes = (response.CreatedDate.getTime() - outbound.CreatedDate.getTime()) / (1000 * 60);
                if (timeDiffMinutes >= 0 && timeDiffMinutes <= 1440) {
                    String actionName = actionIdToNameMap.get(outbound.smagicinteract__Converse_App_Action__c);
                    if (actionName == null) {
                        actionName = 'Unknown Action';
                    }
                    aeMessageResponsesMap.put(
                        actionName,
                        aeMessageResponsesMap.containsKey(actionName) ? aeMessageResponsesMap.get(actionName) + 1 : 1
                    );
                    break;
                }
            }
        }
    }

    /**
     * Updates member wrappers with SMS message counts and response data
     */
    @TestVisible
    private static void populateMemberSmsData(
        List<MemberWrapper> wrappers,
        Map<Id, Integer> leadTextMessageCountMap,
        Map<Id, Integer> contactTextMessageCountMap,
        Map<Id, Integer> leadAEResponseCountMap,
        Map<Id, Integer> contactAEResponseCountMap,
        Map<Id, Integer> leadTotalSmsCountMap,
        Map<Id, Integer> contactTotalSmsCountMap,
        Map<Id, Integer> leadSmsResponseCountMap,
        Map<Id, Integer> contactSmsResponseCountMap,
        Map<Id, String> contactToLeadNumberMap,
        Map<String, Integer> leadNumberTextMessageCountMap
    ) {
        for (MemberWrapper w : wrappers) {
            if (w.memberType == 'Lead' && w.leadId != null) {
                w.textMessageCount = leadTextMessageCountMap.containsKey(w.leadId) ? leadTextMessageCountMap.get(w.leadId) : 0;
                w.totalSmsMessageCount = leadTotalSmsCountMap.containsKey(w.leadId) ? leadTotalSmsCountMap.get(w.leadId) : 0;
                w.accountEngagementResponseCount = leadAEResponseCountMap.containsKey(w.leadId) ? leadAEResponseCountMap.get(w.leadId) : 0;
                w.totalResponseCount = leadSmsResponseCountMap.containsKey(w.leadId) ? leadSmsResponseCountMap.get(w.leadId) : 0;
            } else if (w.memberType == 'Contact' && w.contactId != null) {
                Integer contactTaskCount = contactTextMessageCountMap.containsKey(w.contactId) ? contactTextMessageCountMap.get(w.contactId) : 0;
                
                if (contactToLeadNumberMap.containsKey(w.contactId)) {
                    String contactLeadNumber = contactToLeadNumberMap.get(w.contactId);
                    if (contactLeadNumber != null) {
                        Integer leadNumberTaskCount = leadNumberTextMessageCountMap.containsKey(contactLeadNumber) ? leadNumberTextMessageCountMap.get(contactLeadNumber) : 0;
                        contactTaskCount += leadNumberTaskCount;
                    }
                }
                
                w.textMessageCount = contactTaskCount;
                w.totalSmsMessageCount = contactTotalSmsCountMap.containsKey(w.contactId) ? contactTotalSmsCountMap.get(w.contactId) : 0;
                w.accountEngagementResponseCount = contactAEResponseCountMap.containsKey(w.contactId) ? contactAEResponseCountMap.get(w.contactId) : 0;
                w.totalResponseCount = contactSmsResponseCountMap.containsKey(w.contactId) ? contactSmsResponseCountMap.get(w.contactId) : 0;
            }
        }
    }

    /**
     * Calculates engagement response rates for result map
     */
    @TestVisible
    private static void calculateEngagementRates(Map<String, Object> result) {
        Integer totalAEMessagesSent = (Integer) result.get('totalAETextMessagesSent') != null ? (Integer) result.get('totalAETextMessagesSent') : 0;
        Integer totalAEResponsesCount = (Integer) result.get('accountEngagementResponses') != null ? (Integer) result.get('accountEngagementResponses') : 0;
        Decimal aeResponseRate = totalAEMessagesSent > 0 ? (totalAEResponsesCount * 100.0 / totalAEMessagesSent) : 0;
        result.put('accountEngagementResponseRate', aeResponseRate);
        
        Integer totalMessagesSent = (Integer) result.get('totalSmsMessagesSent') != null ? (Integer) result.get('totalSmsMessagesSent') : 0;
        Integer totalResponsesCount = (Integer) result.get('totalSmsResponses') != null ? (Integer) result.get('totalSmsResponses') : 0;
        Decimal totalResponseRate = totalMessagesSent > 0 ? (totalResponsesCount * 100.0 / totalMessagesSent) : 0;
        result.put('totalResponseRate', totalResponseRate);
    }

    /**
     * Counts members who responded and members who opted out
     */
    @TestVisible
    private static Map<String, Object> countMemberResponses(Set<Id> leadIds, Set<Id> contactIds, Integer totalMembers) {
        Set<Id> membersWhoResponded = new Set<Id>();
        Set<Id> membersOptedOut = new Set<Id>();
        
        try {
            List<smagicinteract__smsMagic__c> allInboundSms = [
                SELECT smagicinteract__Lead__c, smagicinteract__Contact__c, smagicinteract__SMSText__c
                FROM smagicinteract__smsMagic__c
                WHERE smagicinteract__Direction__c = 'IN'
                AND (smagicinteract__Lead__c IN :leadIds OR smagicinteract__Contact__c IN :contactIds)
            ];
            
            for (smagicinteract__smsMagic__c sms : allInboundSms) {
                if (sms.smagicinteract__Lead__c != null) {
                    membersWhoResponded.add(sms.smagicinteract__Lead__c);
                    checkForOptOut(sms.smagicinteract__SMSText__c, sms.smagicinteract__Lead__c, membersOptedOut);
                }
                if (sms.smagicinteract__Contact__c != null) {
                    membersWhoResponded.add(sms.smagicinteract__Contact__c);
                    checkForOptOut(sms.smagicinteract__SMSText__c, sms.smagicinteract__Contact__c, membersOptedOut);
                }
            }
        } catch (Exception e) {
            System.debug('Error counting members who responded: ' + e.getMessage());
        }
        
        Decimal binaryResponseRate = totalMembers > 0 ? (membersWhoResponded.size() * 100.0 / totalMembers) : 0;
        Decimal optOutPercentage = totalMembers > 0 ? (membersOptedOut.size() * 100.0 / totalMembers) : 0;
        
        return new Map<String, Object>{
            'membersWhoResponded' => membersWhoResponded.size(),
            'binaryResponseRate' => binaryResponseRate,
            'membersOptedOut' => membersOptedOut.size(),
            'optOutPercentage' => optOutPercentage
        };
    }

    /**
     * Checks if SMS text contains opt-out keywords
     */
    @TestVisible
    private static void checkForOptOut(String smsText, Id memberId, Set<Id> membersOptedOut) {
        if (smsText == null) return;
        String upperText = smsText.trim().toUpperCase();
        if (upperText == 'STOP' || upperText == 'STOP.' || upperText.contains('STOP') || upperText.contains('OPT OUT') || 
            upperText.contains('OPT-OUT') || upperText.contains('UNSUBSCRIBE') || upperText.contains('REMOVE') || upperText.contains('QUIT')) {
            membersOptedOut.add(memberId);
        }
    }

    /**
     * Builds SMS message distribution by action type and date
     */
    @TestVisible
    private static void buildSmsDateAndActionDistribution(
        List<smagicinteract__smsMagic__c> smsRecords,
        Map<Id, String> actionIdToNameMap,
        Map<String, Integer> textMessagesByDateMap,
        Map<String, Integer> textMessagesByActionTypeMap,
        Map<String, Map<String, Integer>> textMessagesByDateAndActionMap
    ) {
        for (smagicinteract__smsMagic__c sms : smsRecords) {
            if (sms.CreatedDate == null) continue;
            
            String dateStr = String.valueOf(sms.CreatedDate.date());
            textMessagesByDateMap.put(dateStr, textMessagesByDateMap.containsKey(dateStr) ? textMessagesByDateMap.get(dateStr) + 1 : 1);
            
            if (sms.smagicinteract__Converse_App_Action__c != null) {
                String actionName = actionIdToNameMap.get(sms.smagicinteract__Converse_App_Action__c);
                if (actionName == null) {
                    actionName = 'Unknown Action';
                }
                
                textMessagesByActionTypeMap.put(actionName, textMessagesByActionTypeMap.containsKey(actionName) ? textMessagesByActionTypeMap.get(actionName) + 1 : 1);
                
                if (!textMessagesByDateAndActionMap.containsKey(dateStr)) {
                    textMessagesByDateAndActionMap.put(dateStr, new Map<String, Integer>());
                }
                Map<String, Integer> actionCountsByDate = textMessagesByDateAndActionMap.get(dateStr);
                actionCountsByDate.put(actionName, actionCountsByDate.containsKey(actionName) ? actionCountsByDate.get(actionName) + 1 : 1);
            }
        }
    }

    /**
     * Builds SMS message heatmap by hour and day of week
     */
    @TestVisible
    private static void buildSmsHeatmap(List<smagicinteract__smsMagic__c> smsRecords, Map<String, Map<String, Integer>> heatmapByDayHour) {
        for (smagicinteract__smsMagic__c sms : smsRecords) {
            if (sms.CreatedDate == null) continue;
            
            Integer hourOfDay = sms.CreatedDate.hour();
            String dayOfWeekStr = sms.CreatedDate.format('EEEE');
            
            if (!heatmapByDayHour.containsKey(dayOfWeekStr)) {
                heatmapByDayHour.put(dayOfWeekStr, new Map<String, Integer>());
            }
            
            Map<String, Integer> hourCounts = heatmapByDayHour.get(dayOfWeekStr);
            String hourKey = String.valueOf(hourOfDay);
            hourCounts.put(hourKey, hourCounts.containsKey(hourKey) ? hourCounts.get(hourKey) + 1 : 1);
        }
    }
}