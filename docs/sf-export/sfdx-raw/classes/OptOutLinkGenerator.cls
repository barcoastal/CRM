public with sharing class OptOutLinkGenerator {
    
    private static final String LOGGER_CLASS = 'OptOutLinkGenerator';
   
    @InvocableMethod(
        label='Generate Email Opt-Out Link'
        description='Encrypts a Contact ID to create a secure opt-out URL for use in emails'
        callout=false
    )
    public static List<OptOutLinkResult> generateOptOutLink(List<OptOutLinkRequest> requests) {
        List<OptOutLinkResult> results = new List<OptOutLinkResult>();
        
        if (requests == null || requests.isEmpty()) {
            return results;
        }
        
        for (OptOutLinkRequest request : requests) {
            OptOutLinkResult result = new OptOutLinkResult();
            
            try {
                if (String.isBlank(request.contactId)) {
                    continue;
                }
                
                String encryptedId = CryptoUtil.encrypt(request.contactId);
                
                result.encryptedId = encryptedId;
                
                
            } catch (Exception ex) {
                ApplicationLogger.logExceptionWithData(ex, null, LOGGER_CLASS + '.generateOptOutLink', ApplicationLogger.SEVERITY_HIGH);
            }
            
            results.add(result);
        }
        
        return results;
    }

    public class OptOutLinkRequest {
        @InvocableVariable(
            label='Contact ID'
            description='The Contact ID to encrypt for opt-out link'
            required=true
        )
        public String contactId;
    }

    public class OptOutLinkResult {

        @InvocableVariable(
            label='Encrypted ID'
            description='The encrypted Contact ID for URL parameter'
        )
        public String encryptedId;
    }
}