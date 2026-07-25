import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostMediaThumb } from "../PostMediaThumb";

describe("PostMediaThumb", () => {
  it("renders nothing when there is no media", () => {
    const { container } = render(<PostMediaThumb urls={[]} />);
    expect(container).toBeEmptyDOMElement();
    const { container: nullContainer } = render(
      <PostMediaThumb urls={undefined} />,
    );
    expect(nullContainer).toBeEmptyDOMElement();
  });

  it("renders a single image with no count chip", () => {
    render(<PostMediaThumb urls={["https://cdn.test/a.png"]} alt="Austin" />);
    const img = screen.getByAltText("Austin");
    expect(img).toHaveAttribute("src", "https://cdn.test/a.png");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(screen.queryByText(/^×/)).not.toBeInTheDocument();
  });

  it("shows the first slide plus a ×N chip for a carousel", () => {
    const { container } = render(
      <PostMediaThumb
        urls={[
          "https://cdn.test/1.png",
          "https://cdn.test/2.png",
          "https://cdn.test/3.png",
        ]}
      />,
    );
    // alt="" makes the image presentational (no "img" role), so query directly.
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://cdn.test/1.png");
    expect(screen.getByText("×3")).toBeInTheDocument();
    expect(screen.getByLabelText("3 slides")).toBeInTheDocument();
  });

  it("honors an explicit count override", () => {
    render(<PostMediaThumb urls={["https://cdn.test/1.png"]} count={5} />);
    expect(screen.getByText("×5")).toBeInTheDocument();
  });
});
