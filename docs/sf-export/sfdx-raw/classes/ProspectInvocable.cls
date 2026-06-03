public class ProspectInvocable {

    public class ProspectWrapper {
        // Custom Fields
        @AuraEnabled public String utmTerm;
        @AuraEnabled public String utmSource;
        @AuraEnabled public String utmMedium;
        @AuraEnabled public String utmContent;
        @AuraEnabled public String utmCampaign;
        @AuraEnabled public Boolean unsecuredBusinessLoans;
        @AuraEnabled public String subDisposition;
        @AuraEnabled public String status;
        @AuraEnabled public Boolean smsOptOut;
        @AuraEnabled public String mobilePhone;
        @AuraEnabled public String leadVendorIdText;
        @AuraEnabled public String keyword;
        @AuraEnabled public Boolean isEmailBounced;
        @AuraEnabled public String ipAddress;
        @AuraEnabled public String hubspotId;
        @AuraEnabled public String hasMultipleLCA;
        @AuraEnabled public Boolean hasCalendlyEvent;
        @AuraEnabled public String five9LastDisposition;
        @AuraEnabled public Date firstEmailDate;
        @AuraEnabled public Date firstCallDate;
        @AuraEnabled public String externalId;
        @AuraEnabled public String debtOfYourBusiness;
        @AuraEnabled public Boolean deleted;
        @AuraEnabled public String created;
        @AuraEnabled public String adSet;

        // Default Fields
        @AuraEnabled public String zip;
        @AuraEnabled public String yearsInBusiness;
        @AuraEnabled public String website;
        @AuraEnabled public String territory;
        @AuraEnabled public String state;
        @AuraEnabled public String source;
        @AuraEnabled public Date lastScoredAt;
        @AuraEnabled public String salutation;
        @AuraEnabled public String phone;
        @AuraEnabled public Boolean pardotHardBounced;
        @AuraEnabled public Boolean optedOut;
        @AuraEnabled public String lastName;
        @AuraEnabled public String jobTitle;
        @AuraEnabled public String industry;
        @AuraEnabled public String firstName;
        @AuraEnabled public String fax;
        @AuraEnabled public String employees;
        @AuraEnabled public String emailBouncedReason;
        @AuraEnabled public String emailBouncedDate;
        @AuraEnabled public String email;
        @AuraEnabled public Boolean isDoNotEmail;
        @AuraEnabled public Boolean isDoNotCall;
        @AuraEnabled public String department;
        @AuraEnabled public String country;
        @AuraEnabled public String company;
        @AuraEnabled public String comments;
        @AuraEnabled public String city;
        @AuraEnabled public String annualRevenue;
        @AuraEnabled public String addressTwo;
        @AuraEnabled public String addressOne;
    }

    @InvocableMethod(label='Send Prospect to Account Engagement' description='Sends prospect data to Account Engagement via external activities API')
    public static void debugProspectValues(List<String> prospectJsonList) {
        for (String prospectJson : prospectJsonList) {
            if (String.isNotBlank(prospectJson)) {
                // Deserialize the prospect data
                ProspectWrapper prospect = (ProspectWrapper) JSON.deserialize(prospectJson, ProspectWrapper.class);
                System.debug('Prospect Values: ' + JSON.serialize(prospect));
                
                // Prepare the payload for Account Engagement external activities API
                Map<String, Object> payload = new Map<String, Object>();
                payload.put('extension', 'ProspectInvocable');
                payload.put('type', 'ProspectInvocable');
                payload.put('value', prospectJson); // Store the full prospect JSON as the value
                
                // TODO: Implement HTTP callout to POST /api/v5/external-activities
                // This would require:
                // 1. OAuth authentication to get access token
                // 2. HTTP POST request to Pardot API
                // 3. Proper error handling
                
                System.debug('Payload for Account Engagement: ' + JSON.serialize(payload));
            }
        }
    }
}