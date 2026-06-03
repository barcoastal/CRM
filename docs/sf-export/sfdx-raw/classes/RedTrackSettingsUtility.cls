//Util class for RedTrack Settings
public inherited sharing class RedTrackSettingsUtility {
    
    private static Map<String, RedTrack_Settings__mdt> settingsMap = fetchCustomMetadataSettings();

    private static Map<String, RedTrack_Settings__mdt> fetchCustomMetadataSettings() {
        if (settingsMap != null && !settingsMap.isEmpty()) {
            return settingsMap;
        } else {
            return RedTrack_Settings__mdt.getAll();
        }
    }

    public static String getLeadCreationEndpoint(String leadSource) {
        String endpoint;
        if(leadSource == LeadUtil.LEAD_SOURCE_AFFILIATE){
           if (settingsMap != null && !settingsMap.isEmpty() && settingsMap.containsKey('Affiliate')
                && settingsMap.get('Affiliate').Lead_Creation_Endpoint__c != null
               ) {
                   endpoint = settingsMap.get('Affiliate').Lead_Creation_Endpoint__c;
               }
        } else {
            if (settingsMap != null && !settingsMap.isEmpty() && settingsMap.containsKey('RedTrack_Integration')
                && settingsMap.get('RedTrack_Integration').Lead_Creation_Endpoint__c != null
               ) {
                   endpoint = settingsMap.get('RedTrack_Integration').Lead_Creation_Endpoint__c;
               }
        }
        return endpoint;
    }

    public static String getLeadQualificationEndpoint(String leadSource) {
        String endpoint;
        if(leadSource == LeadUtil.LEAD_SOURCE_AFFILIATE){
            if (settingsMap != null && !settingsMap.isEmpty() && settingsMap.containsKey('Affiliate')
            && settingsMap.get('Affiliate').Lead_Qualification_Endpoint__c != null
            ) {
                endpoint = settingsMap.get('Affiliate').Lead_Qualification_Endpoint__c;
            } 
        } else {
            if (settingsMap != null && !settingsMap.isEmpty() && settingsMap.containsKey('RedTrack_Integration')
            && settingsMap.get('RedTrack_Integration').Lead_Qualification_Endpoint__c != null
            ) {
                endpoint = settingsMap.get('RedTrack_Integration').Lead_Qualification_Endpoint__c;
            } 
        }
        
        return endpoint;
    }

    public static String getOpportunityCreationEndpoint(String leadSource) {
        String endpoint;
        if(leadSource == LeadUtil.LEAD_SOURCE_AFFILIATE){
            if (settingsMap != null && !settingsMap.isEmpty() && settingsMap.containsKey('Affiliate')
            && settingsMap.get('Affiliate').Opportunity_Creation_Endpoint__c != null
            ) {
                endpoint = settingsMap.get('Affiliate').Opportunity_Creation_Endpoint__c;
            }
        } else {
            if (settingsMap != null && !settingsMap.isEmpty() && settingsMap.containsKey('RedTrack_Integration')
            && settingsMap.get('RedTrack_Integration').Opportunity_Creation_Endpoint__c != null
            ) {
                endpoint = settingsMap.get('RedTrack_Integration').Opportunity_Creation_Endpoint__c;
            }
        }
        
        return endpoint;
    }

    public static String getContractSentEndpoint(String leadSource) {
        String endpoint;
        if(leadSource == LeadUtil.LEAD_SOURCE_AFFILIATE){
            if (settingsMap != null && !settingsMap.isEmpty() && settingsMap.containsKey('Affiliate')
            && settingsMap.get('Affiliate').Contract_Sent_Endpoint__c != null
            ) {
                endpoint = settingsMap.get('Affiliate').Contract_Sent_Endpoint__c;
            }
        } else {
            if (settingsMap != null && !settingsMap.isEmpty() && settingsMap.containsKey('RedTrack_Integration')
            && settingsMap.get('RedTrack_Integration').Contract_Sent_Endpoint__c != null
            ) {
                endpoint = settingsMap.get('RedTrack_Integration').Contract_Sent_Endpoint__c;
            }
        }
       
        return endpoint;
    }

    public static String getOpportunityClosedWonEndpoint(String leadSource) {
        String endpoint;
        if(leadSource == LeadUtil.LEAD_SOURCE_AFFILIATE){
              if (settingsMap != null && !settingsMap.isEmpty() && settingsMap.containsKey('Affiliate')
                && settingsMap.get('Affiliate').Opportunity_Closed_Won_Endpoint__c != null
                ) {
                    endpoint = settingsMap.get('Affiliate').Opportunity_Closed_Won_Endpoint__c;
                }
        } else {
            if (settingsMap != null && !settingsMap.isEmpty() && settingsMap.containsKey('RedTrack_Integration')
            && settingsMap.get('RedTrack_Integration').Opportunity_Closed_Won_Endpoint__c != null
            ) {
                endpoint = settingsMap.get('RedTrack_Integration').Opportunity_Closed_Won_Endpoint__c;
            }
        }
      
        return endpoint;
    }

    public static String getOpportunityFirstPaymentEndpoint(String leadSource) {
        String endpoint;
        if(leadSource == LeadUtil.LEAD_SOURCE_AFFILIATE){
            if (settingsMap != null && !settingsMap.isEmpty() && settingsMap.containsKey('Affiliate')
            && settingsMap.get('Affiliate').Opportunity_First_Payment_Endpoint__c != null
            ) {
                endpoint = settingsMap.get('Affiliate').Opportunity_First_Payment_Endpoint__c;
            }
        } else {
            if (settingsMap != null && !settingsMap.isEmpty() && settingsMap.containsKey('RedTrack_Integration')
            && settingsMap.get('RedTrack_Integration').Opportunity_First_Payment_Endpoint__c != null
            ) {
                endpoint = settingsMap.get('RedTrack_Integration').Opportunity_First_Payment_Endpoint__c;
            }
        }
       
        return endpoint;
    }
    
    public static String getInboundLeadQualificationEndpoint() {
        String endpoint;
        if (settingsMap != null && !settingsMap.isEmpty() && settingsMap.containsKey('RedTrack_Integration')
            && settingsMap.get('RedTrack_Integration').Inbound_Lead_Qualification_Endpoint__c != null
        ) {
            endpoint = settingsMap.get('RedTrack_Integration').Inbound_Lead_Qualification_Endpoint__c;
        }
        return endpoint;
    }
    
    public static String getInboundLeadCreationEndpoint() {
        String endpoint;
        if (settingsMap != null && !settingsMap.isEmpty() && settingsMap.containsKey('RedTrack_Integration')
            && settingsMap.get('RedTrack_Integration').Inbound_Lead_Creation_Endpoint__c != null
        ) {
            endpoint = settingsMap.get('RedTrack_Integration').Inbound_Lead_Creation_Endpoint__c;
        }
        return endpoint;
    }

}