package org.openlearn.service;

import java.util.List;
import java.util.stream.Collectors;

import org.openlearn.domain.Assignment;
import org.openlearn.domain.Authority;
import org.openlearn.domain.Course;
import org.openlearn.domain.StudentAssignment;
import org.openlearn.domain.User;
import org.openlearn.dto.StudentAssignmentDTO;
import org.openlearn.repository.AssignmentRepository;
import org.openlearn.repository.CourseRepository;
import org.openlearn.repository.StudentAssignmentRepository;
import org.openlearn.repository.UserRepository;
import org.openlearn.security.AuthoritiesConstants;
import org.openlearn.security.SecurityUtils;
import org.openlearn.transformer.StudentAssignmentTransformer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service Implementation for managing StudentAssignment.
 */
@Service
@Transactional
public class StudentAssignmentService {

	private static final Authority STUDENT = new Authority(AuthoritiesConstants.STUDENT);

	private static final Logger log = LoggerFactory.getLogger(StudentAssignmentService.class);

	private final AssignmentRepository assignmentRepository;

	private final CourseRepository courseRepository;

	private final StudentAssignmentRepository studentAssignmentRepository;

	private final StudentAssignmentTransformer studentAssignmentTransformer;

	private final UserRepository userRepository;

	private final UserService userService;

	public StudentAssignmentService(final AssignmentRepository assignmentRepository,
	                                final CourseRepository courseRepository,
	                                final StudentAssignmentRepository studentAssignmentRepository,
	                                final StudentAssignmentTransformer studentAssignmentTransformer,
	                                final UserRepository userRepository,
									final UserService userService) {
		this.assignmentRepository = assignmentRepository;
		this.courseRepository = courseRepository;
		this.studentAssignmentRepository = studentAssignmentRepository;
		this.studentAssignmentTransformer = studentAssignmentTransformer;
		this.userRepository = userRepository;
		this.userService = userService;
	}

	/**
	 * Save a studentAssignment.
	 *
	 * @param studentAssignmentDTO the entity to save
	 * @return the persisted entity
	 */
	public StudentAssignmentDTO save(final StudentAssignmentDTO studentAssignmentDTO) {
		log.debug("Request to save StudentAssignment : {}", studentAssignmentDTO);
		User user = userService.getCurrentUser();
		boolean instructorCheck = true;
		if (SecurityUtils.isCurrentUserInRole(AuthoritiesConstants.INSTRUCTOR)) {
			StudentAssignment studentAssignment = studentAssignmentRepository.findOne(studentAssignmentDTO.getId());
			Course course = studentAssignment.getAssignment().getCourse();
			instructorCheck = user.getId() == course.getInstructor().getId();
		}

		if (instructorCheck && (SecurityUtils.isAdmin() || inOrgOfCurrentUser(studentAssignmentDTO))) {
			return studentAssignmentTransformer.transform(studentAssignmentRepository
				.save(studentAssignmentTransformer.transform(studentAssignmentDTO)));
		}
		// TODO: Error handling / logging
		return null;
	}

	/**
	 * Get one studentAssignment by id.
	 *
	 * @param id the id of the entity
	 * @return the entity
	 */
	@Transactional(readOnly = true)
	public StudentAssignmentDTO findOne(final Long id) {
		log.debug("Request to get StudentAssignment : {}", id);
		StudentAssignment studentAssignment = studentAssignmentRepository.findOne(id);
		if (studentAssignment != null && (SecurityUtils.isAdmin() || inOrgOfCurrentUser(studentAssignment))) {
			return studentAssignmentTransformer.transform(studentAssignment);
		}
		// TODO: Error handling / logging
		return null;
	}

	/**
	 * Get a list studentAssignment by student.
	 *
	 * @param id the id of the student
	 * @return the list of student assignments
	 */
	@Transactional(readOnly = true)
	public List<StudentAssignmentDTO> findByStudent(final Long id) {
		log.debug("Request to get StudentAssignments by Student : {}", id);
		User student = userRepository.findOneByIdAndAuthority(id, STUDENT);
		if (student != null && (SecurityUtils.isAdmin() || inOrgOfCurrentUser(student))) {
			return studentAssignmentRepository.findByStudent(student).stream()
				.map((StudentAssignment studentAssignment) ->
					studentAssignmentTransformer.transform(studentAssignment, false, true))
				.collect(Collectors.toList());
		}
		// TODO: Error handling / logging
		return null;
	}

	/**
	 * Get a list studentAssignment by student and course.
	 *
	 * @param studentId the id of the student
	 * @patam courseId the id of the course
	 * @return the list of student assignments
	 */
	@Transactional(readOnly = true)
	public List<StudentAssignmentDTO> findByStudentAndCourse(final Long studentId, final Long courseId) {
		log.debug("Request to get StudentAssignments by Student : {} and Course : {}", studentId, courseId);
		User student = userRepository.findOneByIdAndAuthority(studentId, STUDENT);
			if (student != null && (SecurityUtils.isAdmin() || inOrgOfCurrentUser(student))) {

				return studentAssignmentRepository.findByStudent(student).stream()
					.filter((StudentAssignment studentAssignment) ->
						studentAssignment.getAssignment().getCourse().getId().equals(courseId))
					.map((StudentAssignment studentAssignment) ->
						studentAssignmentTransformer.transform(studentAssignment, false, true))
					.collect(Collectors.toList());
			}
		// TODO: Error handling / logging
		return null;
	}

	/**
	 * Get a list studentAssignment by student that are on a student's portfolio.
	 *
	 * @param id the id of the student
	 * @return the list of student assignments
	 */
	@Transactional(readOnly = true)
	public List<StudentAssignment> findFlaggedByStudent(final Long id) {
		log.debug("Request to get portfolio StudentAssignments by Student : {}", id);
		User student = userRepository.findOneByIdAndAuthority(id, STUDENT);
		if (student != null && (SecurityUtils.isAdmin() || inOrgOfCurrentUser(student))) {
			return studentAssignmentRepository.findByStudentAndAndOnPortfolio(student, true);
		}
		// TODO: Error handling / logging
		return null;
	}

	/**
	 * Get a list studentAssignment by assignment.
	 *
	 * @param id the id of the assignment
	 * @return the list of student assignments
	 */
	@Transactional(readOnly = true)
	public List<StudentAssignmentDTO> findByAssignment(final Long id) {
		log.debug("Request to get StudentAssignments by Assignment : {}", id);
		Assignment assignment = assignmentRepository.findOne(id);
		if (assignment != null && (SecurityUtils.isAdmin() || inOrgOfCurrentUser(assignment))) {
			return studentAssignmentRepository.findByAssignment(assignment).stream()
				.map((StudentAssignment studentAssignment) ->
					studentAssignmentTransformer.transform(studentAssignment, true, false))
				.collect(Collectors.toList());
		}
		// TODO: Error handling / logging
		return null;
	}

	/**
	 * Delete the studentAssignment by id.
	 *
	 * @param id the id of the entity
	 */
	public void delete(final Long id) {
		log.debug("Request to delete StudentAssignment : {}", id);
		StudentAssignment studentAssignment = studentAssignmentRepository.findOne(id);
		boolean instructorCheck = true;
		if (SecurityUtils.isCurrentUserInRole(AuthoritiesConstants.INSTRUCTOR)) {
			User user = userService.getCurrentUser();
			Course course = studentAssignment.getAssignment().getCourse();
			instructorCheck = user.getId() == course.getInstructor().getId();
		}

		if (studentAssignment != null && (SecurityUtils.isAdmin() || inOrgOfCurrentUser(studentAssignment)) && instructorCheck) {
			studentAssignmentRepository.delete(id);
		} else {
			// TODO: Error handling / logging
		}
	}

	private boolean inOrgOfCurrentUser(final StudentAssignmentDTO studentAssignmentDTO) {
		User user = userService.getCurrentUser();
		User student = userRepository.findOneByIdAndAuthority(studentAssignmentDTO.getStudentId(), STUDENT);
		Assignment assignment = assignmentRepository.findOne(studentAssignmentDTO.getAssignmentId());
		return user.getOrganization().getId().equals(student.getOrganization().getId())
			&& user.getOrganization().getId().equals(assignment.getOrganization().getId());
	}

	private boolean inOrgOfCurrentUser(final StudentAssignment studentAssignment) {
		User user = userService.getCurrentUser();
		return user.getOrganization().equals(studentAssignment.getStudent().getOrganization())
			&& user.getOrganization().equals(studentAssignment.getAssignment().getOrganization());
	}

	private boolean inOrgOfCurrentUser(final User student) {
		User user = userService.getCurrentUser();
		return user.getOrganization().equals(student.getOrganization());
	}

	private boolean inOrgOfCurrentUser(final Assignment assignment) {
		User user = userService.getCurrentUser();
		return user.getOrganization().equals(assignment.getOrganization());
	}
}
