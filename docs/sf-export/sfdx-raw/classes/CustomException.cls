/**
 * @Description: Custom Exception class. 
 */
public inherited sharing class CustomException extends Exception {
    public static void variableBlankException(String variableName) {
        throw new CustomException(
            String.format(
                '{0} should not be blank.',
                new List<String>{variableName}
            )
        );
    }
}