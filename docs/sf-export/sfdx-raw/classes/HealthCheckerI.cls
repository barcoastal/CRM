/**
 * Description:
 * Interface to be implemented to support checking the health of an Object.
 *                                          
 * History:
 **/
public interface HealthCheckerI {
    List<HealthCheckerResult> check(Id id);
}