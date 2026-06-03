public without sharing class OptOutEmailController {
    
    private static final String ERROR_GENERIC = 'An unexpected error occurred while opting out of emails. Please contact your system administrator.';
    private static final String SUCCESS_MESSAGE = 'Email opt-out has been completed successfully.';
    
    private static final String STATUS_SUCCESS = 'success';
    private static final String STATUS_ERROR = 'error';
    
    private static final String LOGGER_CLASS = 'OptOutEmailController';

    @AuraEnabled(cacheable=false)
    public static Map<String, String> processOptOut(String encryptedContactId) {
        Map<String, String> response = new Map<String, String>();
        
        try {
            if (String.isBlank(encryptedContactId)) {
                return buildErrorResponse(ERROR_GENERIC);
            }

            String contactId;
            if(isSalesforceId(encryptedContactId)) {
                Id tempId = Id.valueOf(encryptedContactId);
                if (tempId.getSObjectType() == Contact.SObjectType) {
                    contactId = encryptedContactId;
                }
            }  else {
                contactId = CryptoUtil.decrypt(encryptedContactId);
            }
            
            if (String.isBlank(contactId)) {
                return buildErrorResponse(ERROR_GENERIC);
            }
            
            Contact contact = queryContact(contactId);
            
            if (!contact.HasOptedOutOfEmail) {
                updateContactOptOut(contact);
            }
            
            return buildSuccessResponse(SUCCESS_MESSAGE);
            
        } catch (CryptoUtil.CryptoException ex) {
            return handleCryptoError(ex, LOGGER_CLASS + '.processOptOut');
        }  catch (Exception ex) {
            return handleUnexpectedError(ex, LOGGER_CLASS + '.processOptOut');
        }
    }
    

    private static Contact queryContact(String contactId) {
        return [
            SELECT Id, HasOptedOutOfEmail
            FROM Contact
            WHERE Id = :contactId
            LIMIT 1
        ];
    }
    

    private static void updateContactOptOut(Contact contact) {

        contact.HasOptedOutOfEmail = true;
        update contact;
    }
    

    private static Map<String, String> buildSuccessResponse(String message) {
        Map<String, String> response = new Map<String, String>();
        response.put('status', STATUS_SUCCESS);
        response.put('message', message);
        return response;
    }

    private static Map<String, String> buildErrorResponse(String message) {
        Map<String, String> response = new Map<String, String>();
        response.put('status', STATUS_ERROR);
        response.put('message', message);
        return response;
    }

    private static Map<String, String> handleCryptoError(CryptoUtil.CryptoException ex, String methodName) {
        ApplicationLogger.logExceptionWithData(ex, null, methodName, ApplicationLogger.SEVERITY_HIGH);
        return buildErrorResponse(ERROR_GENERIC);
    }
 
    private static Map<String, String> handleUnexpectedError(Exception ex, String methodName) {
        ApplicationLogger.logExceptionWithData(ex, null, methodName, ApplicationLogger.SEVERITY_HIGH);
        return buildErrorResponse(ERROR_GENERIC);
    }

    private static Boolean isSalesforceId(String inputId) {
        return !String.isBlank(inputId) &&
            (inputId.length() == 15 || inputId.length() == 18) &&
            Pattern.matches('^[a-zA-Z0-9]+$', inputId);
    }
    
}